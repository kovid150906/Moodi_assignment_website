const { getPool } = require('../config/database');

class LeaderboardService {
  // Get overall leaderboard stats
  async getOverallStats() {
    const db = getPool();
    const [stats] = await db.execute(`
      SELECT 
        (SELECT COUNT(*) FROM competitions WHERE status = 'ACTIVE') as active_competitions,
        (SELECT COUNT(*) FROM participations) as total_participations,
        (SELECT COUNT(*) FROM results WHERE result_status = 'WINNER') as total_winners,
        (SELECT COUNT(*) FROM cities WHERE status = 'ACTIVE') as active_cities
    `);

    return stats[0];
  }

  // Get top performers
  async getTopPerformers(limit = 10) {
    const db = getPool();
    const limitNum = parseInt(limit) || 10;
    const [performers] = await db.query(`
      SELECT 
        u.id,
        u.mi_id,
        u.full_name,
        COUNT(DISTINCT p.id) as total_participations,
        SUM(CASE WHEN r.result_status = 'WINNER' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN r.position = 1 THEN 1 ELSE 0 END) as first_places
      FROM users u
      JOIN participations p ON u.id = p.user_id
      LEFT JOIN results r ON r.participation_id = p.id
      WHERE u.status = 'ACTIVE'
      GROUP BY u.id, u.mi_id, u.full_name
      HAVING wins > 0
      ORDER BY wins DESC, first_places DESC
      LIMIT ${limitNum}
    `);

    return performers;
  }

  // Get competition leaderboard (legacy)
  async getCompetitionLeaderboard(competitionId) {
    const db = getPool();
    const [leaderboard] = await db.execute(`
      SELECT 
        u.id,
        u.mi_id,
        u.full_name,
        ci.name as city_name,
        r.result_status,
        r.position,
        r.score
      FROM participations p
      JOIN users u ON p.user_id = u.id
      JOIN cities ci ON p.city_id = ci.id
      LEFT JOIN results r ON r.participation_id = p.id
      WHERE p.competition_id = ?
        AND r.result_status IS NOT NULL
      ORDER BY r.position ASC, r.score DESC
    `, [competitionId]);

    return leaderboard;
  }

  // Get city leaderboard - includes both legacy results and round-based winners
  async getCityLeaderboard(cityId) {
    const db = getPool();
    
    // Get round-based winners (new system)
    const [roundWinners] = await db.execute(`
      SELECT 
        u.id,
        u.mi_id,
        u.full_name,
        comp.name as competition_name,
        'WINNER' as result_status,
        rs.winner_position as position,
        r.name as round_name,
        rs.score
      FROM round_scores rs
      JOIN round_participations rp ON rp.id = rs.round_participation_id
      JOIN rounds r ON r.id = rp.round_id
      JOIN participations p ON p.id = rp.participation_id
      JOIN users u ON u.id = p.user_id
      JOIN competitions comp ON comp.id = p.competition_id
      WHERE p.city_id = ? AND rs.is_winner = TRUE AND r.is_finale = TRUE
      ORDER BY comp.name, rs.winner_position ASC
    `, [cityId]);

    // Get legacy results (old system)
    const [legacyResults] = await db.execute(`
      SELECT 
        u.id,
        u.mi_id,
        u.full_name,
        c.name as competition_name,
        res.result_status,
        res.position,
        NULL as round_name,
        NULL as score
      FROM participations p
      JOIN users u ON p.user_id = u.id
      JOIN competitions c ON p.competition_id = c.id
      JOIN results res ON res.participation_id = p.id
      WHERE p.city_id = ? AND res.result_status IS NOT NULL
      ORDER BY c.name, res.position ASC
    `, [cityId]);

    // Combine both, prioritizing round winners
    return [...roundWinners, ...legacyResults];
  }

  // ============================================
  // NEW ROUND-BASED LEADERBOARD METHODS
  // ============================================

  // Get competitions with rounds for leaderboard listing
  async getCompetitionsWithRounds() {
    const db = getPool();

    try {
      const [competitions] = await db.execute(`
        SELECT 
          c.id,
          c.name,
          c.status,
          (SELECT COUNT(*) FROM rounds r WHERE r.competition_id = c.id) as round_count,
          (SELECT COUNT(*) FROM rounds r WHERE r.competition_id = c.id AND r.is_finale = TRUE AND r.status = 'COMPLETED') as has_finale_winners,
          (SELECT COUNT(*) FROM participations p WHERE p.competition_id = c.id) as participant_count
        FROM competitions c
        WHERE c.status IN ('ACTIVE', 'COMPLETED')
        ORDER BY c.status ASC, c.created_at DESC
      `);
      return competitions;
    } catch (err) {
      // If rounds table doesn't exist yet, return empty
      return [];
    }
  }

  // Get all rounds for a competition
  async getCompetitionRounds(competitionId) {
    const db = getPool();

    try {
      const [rounds] = await db.execute(`
        SELECT 
          r.id,
          r.city_id,
          c.name as city_name,
          r.round_number,
          r.name,
          r.round_date,
          r.is_finale,
          r.status,
          (SELECT COUNT(*) FROM round_participations rp WHERE rp.round_id = r.id) as participant_count
        FROM rounds r
        JOIN cities c ON c.id = r.city_id
        WHERE r.competition_id = ?
        ORDER BY c.name, r.round_number
      `, [competitionId]);
      return rounds;
    } catch (err) {
      return [];
    }
  }

  // Get round leaderboard (public)
  async getRoundLeaderboard(roundId) {
    const db = getPool();

    try {
      const [round] = await db.execute(`
        SELECT 
          r.*,
          c.name as city_name,
          comp.id as competition_id,
          comp.name as competition_name
        FROM rounds r
        JOIN cities c ON c.id = r.city_id
        JOIN competitions comp ON comp.id = r.competition_id
        WHERE r.id = ?
      `, [roundId]);

      if (round.length === 0) {
        return null;
      }

      const [scores] = await db.execute(`
        SELECT 
          u.mi_id,
          u.full_name,
          c.name as city_name,
          rs.score,
          rs.rank_in_round,
          rs.is_winner,
          rs.winner_position
        FROM round_participations rp
        JOIN participations p ON p.id = rp.participation_id
        JOIN users u ON u.id = p.user_id
        JOIN cities c ON c.id = p.city_id
        LEFT JOIN round_scores rs ON rs.round_participation_id = rp.id
        WHERE rp.round_id = ?
        ORDER BY rs.score DESC, u.full_name
      `, [roundId]);

      return {
        ...round[0],
        leaderboard: scores
      };
    } catch (err) {
      return null;
    }
  }

  // Get winners for a competition (finale winners)
  async getCompetitionWinners(competitionId) {
    const db = getPool();

    try {
      const [winners] = await db.execute(`
        SELECT 
          u.mi_id,
          u.full_name,
          c.name as city_name,
          r.name as round_name,
          rs.score,
          rs.winner_position
        FROM round_scores rs
        JOIN round_participations rp ON rp.id = rs.round_participation_id
        JOIN rounds r ON r.id = rp.round_id
        JOIN participations p ON p.id = rp.participation_id
        JOIN users u ON u.id = p.user_id
        JOIN cities c ON c.id = p.city_id
        WHERE r.competition_id = ? AND rs.is_winner = TRUE AND r.is_finale = TRUE
        ORDER BY c.name, rs.winner_position
      `, [competitionId]);

      return winners;
    } catch (err) {
      return [];
    }
  }

  // Get user's round positions in a competition
  async getUserRoundPositions(userId, competitionId) {
    const db = getPool();

    try {
      const [positions] = await db.execute(`
        SELECT 
          r.id as round_id,
          r.name as round_name,
          r.round_number,
          c.name as city_name,
          rs.score,
          rs.rank_in_round,
          rs.is_winner,
          rs.winner_position
        FROM participations p
        JOIN round_participations rp ON rp.participation_id = p.id
        JOIN rounds r ON r.id = rp.round_id
        JOIN cities c ON c.id = p.city_id
        LEFT JOIN round_scores rs ON rs.round_participation_id = rp.id
        WHERE p.user_id = ? AND p.competition_id = ?
        ORDER BY c.name, r.round_number
      `, [userId, competitionId]);

      return positions;
    } catch (err) {
      return [];
    }
  }
}

module.exports = new LeaderboardService();

