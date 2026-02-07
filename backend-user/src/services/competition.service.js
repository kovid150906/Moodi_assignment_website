const { getPool } = require('../config/database');

class CompetitionService {
  // Get open competitions with cities (with search and filter support)
  async getOpenCompetitions(filters = {}) {
    const db = getPool();
    let query = `
      SELECT 
        c.id,
        c.name,
        c.description,
        c.start_date,
        c.end_date,
        c.status,
        c.registration_open
      FROM competitions c
      WHERE c.status IN ('DRAFT', 'ACTIVE', 'COMPLETED')
    `;
    const params = [];

    // Search by name
    if (filters.search) {
      query += ' AND c.name LIKE ?';
      params.push(`%${filters.search}%`);
    }

    // Filter by status
    if (filters.status) {
      query += ' AND c.status = ?';
      params.push(filters.status);
    }

    // Filter by registration open
    if (filters.registration_open !== undefined) {
      query += ' AND c.registration_open = ?';
      params.push(filters.registration_open);
    }

    query += ' ORDER BY c.registration_open DESC, c.start_date DESC';

    const [competitions] = await db.execute(query, params);

    // Get cities for each competition
    for (const competition of competitions) {
      let citiesQuery = `
        SELECT 
          cc.id as competition_city_id,
          ci.id as city_id,
          ci.name as city_name,
          cc.event_date,
          (SELECT COUNT(*) FROM participations p WHERE p.competition_id = ? AND p.city_id = ci.id) as participant_count
        FROM competition_cities cc
        JOIN cities ci ON cc.city_id = ci.id
        WHERE cc.competition_id = ? AND ci.status = 'ACTIVE'
      `;
      const cityParams = [competition.id, competition.id];

      // Filter by city
      if (filters.city_id) {
        citiesQuery += ' AND ci.id = ?';
        cityParams.push(filters.city_id);
      }

      citiesQuery += ' ORDER BY ci.name';

      const [cities] = await db.execute(citiesQuery, cityParams);

      // If filtering by city and no cities match, exclude this competition
      if (filters.city_id && cities.length === 0) {
        competition.exclude = true;
        continue;
      }

      competition.cities = cities;
      competition.total_participants = cities.reduce((sum, c) => sum + (c.participant_count || 0), 0);
    }

    // Filter out excluded competitions
    return competitions.filter(c => !c.exclude);
  }

  // Get detailed competition info with participant counts
  async getCompetitionDetails(id) {
    const db = getPool();
    const [competitions] = await db.execute(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.start_date,
        c.end_date,
        c.registration_open,
        c.status,
        c.created_at
      FROM competitions c
      WHERE c.id = ?
    `, [id]);

    if (competitions.length === 0) {
      return null;
    }

    const competition = competitions[0];

    // Get cities with participant counts
    const [cities] = await db.execute(`
      SELECT 
        cc.id as competition_city_id,
        ci.id as city_id,
        ci.name as city_name,
        cc.event_date,
        (SELECT COUNT(*) FROM participations p WHERE p.competition_id = ? AND p.city_id = ci.id) as participant_count
      FROM competition_cities cc
      JOIN cities ci ON cc.city_id = ci.id
      WHERE cc.competition_id = ? AND ci.status = 'ACTIVE'
      ORDER BY ci.name
    `, [id, id]);

    competition.cities = cities;
    competition.total_participants = cities.reduce((sum, c) => sum + (c.participant_count || 0), 0);

    // Get winner preview - first try round-based winners (new system)
    const [roundWinners] = await db.execute(`
      SELECT 
        u.full_name,
        ci.name as city_name,
        r.name as round_name,
        rs.winner_position as position,
        rs.score
      FROM round_scores rs
      JOIN round_participations rp ON rp.id = rs.round_participation_id
      JOIN rounds r ON r.id = rp.round_id
      JOIN participations p ON p.id = rp.participation_id
      JOIN users u ON u.id = p.user_id
      JOIN cities ci ON ci.id = p.city_id
      WHERE r.competition_id = ? AND rs.is_winner = TRUE AND r.is_finale = TRUE
      ORDER BY rs.winner_position ASC
    `, [id]);

    // Fallback to legacy results table if no round winners
    if (roundWinners.length === 0) {
      const [legacyWinners] = await db.execute(`
        SELECT 
          u.full_name,
          ci.name as city_name,
          r.position
        FROM results r
        JOIN participations p ON r.participation_id = p.id
        JOIN users u ON p.user_id = u.id
        JOIN cities ci ON p.city_id = ci.id
        WHERE p.competition_id = ? AND r.result_status = 'WINNER'
        ORDER BY r.position ASC
        LIMIT 5
      `, [id]);
      competition.winners = legacyWinners;
    } else {
      competition.winners = roundWinners;
    }

    // Get round-wise winners/standings for all rounds
    const [roundResults] = await db.execute(`
      SELECT 
        r.id as round_id,
        r.name as round_name,
        r.round_number,
        r.is_finale,
        r.status,
        ci.name as city_name,
        u.full_name,
        rs.score,
        rs.rank_in_round,
        rs.is_winner,
        rs.winner_position
      FROM rounds r
      JOIN cities ci ON ci.id = r.city_id
      LEFT JOIN round_participations rp ON rp.round_id = r.id
      LEFT JOIN participations p ON p.id = rp.participation_id
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN round_scores rs ON rs.round_participation_id = rp.id
      WHERE r.competition_id = ? AND (rs.is_winner = TRUE OR rs.rank_in_round <= 3)
      ORDER BY ci.name, r.round_number, rs.rank_in_round
    `, [id]);

    // Group results by city and round
    const roundResultsByCity = roundResults.reduce((acc, row) => {
      if (!row.round_id) return acc;
      const key = `${row.city_name}`;
      if (!acc[key]) acc[key] = [];
      const existingRound = acc[key].find(r => r.round_id === row.round_id);
      if (existingRound) {
        if (row.full_name) {
          existingRound.top_participants.push({
            full_name: row.full_name,
            score: row.score,
            rank: row.rank_in_round,
            is_winner: row.is_winner,
            position: row.winner_position
          });
        }
      } else {
        acc[key].push({
          round_id: row.round_id,
          round_name: row.round_name,
          round_number: row.round_number,
          is_finale: row.is_finale,
          status: row.status,
          top_participants: row.full_name ? [{
            full_name: row.full_name,
            score: row.score,
            rank: row.rank_in_round,
            is_winner: row.is_winner,
            position: row.winner_position
          }] : []
        });
      }
      return acc;
    }, {});

    competition.round_results = roundResultsByCity;

    return competition;
  }

  // Get competition by ID
  async getCompetitionById(id) {
    const db = getPool();
    const [competitions] = await db.execute(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.start_date,
        c.end_date,
        c.registration_open,
        c.status
      FROM competitions c
      WHERE c.id = ?
    `, [id]);

    if (competitions.length === 0) {
      return null;
    }

    const competition = competitions[0];

    // Get cities
    const [cities] = await db.execute(`
      SELECT 
        cc.id as competition_city_id,
        ci.id as city_id,
        ci.name as city_name,
        cc.event_date,
        cc.registration_open as city_registration_open
      FROM competition_cities cc
      JOIN cities ci ON cc.city_id = ci.id
      WHERE cc.competition_id = ? AND ci.status = 'ACTIVE'
      ORDER BY ci.name
    `, [id]);

    competition.cities = cities;
    return competition;
  }

  // Register user for competition
  async registerForCompetition(userId, competitionId, cityId) {
    const db = getPool();
    // Check if competition exists and is open
    const competition = await this.getCompetitionById(competitionId);

    if (!competition) {
      throw new Error('Competition not found');
    }

    if (!competition.registration_open) {
      throw new Error('Registration is closed for this competition');
    }

    // Can only register for DRAFT or ACTIVE competitions
    if (!['DRAFT', 'ACTIVE'].includes(competition.status)) {
      throw new Error('Cannot register for completed or cancelled competitions');
    }

    // Check if city is valid for this competition AND if registration is open for that city
    const validCity = competition.cities.find(c => c.city_id === cityId);
    if (!validCity) {
      throw new Error('Invalid city for this competition');
    }

    // Check per-city registration status
    const [cityRegistration] = await db.execute(
      'SELECT registration_open FROM competition_cities WHERE competition_id = ? AND city_id = ?',
      [competitionId, cityId]
    );
    
    if (cityRegistration.length === 0 || !cityRegistration[0].registration_open) {
      throw new Error('Registration is closed for this competition in the selected city');
    }

    // Check for duplicate registration (same user, same competition, same city)
    const [existing] = await db.execute(
      'SELECT id FROM participations WHERE user_id = ? AND competition_id = ? AND city_id = ?',
      [userId, competitionId, cityId]
    );

    if (existing.length > 0) {
      throw new Error('Already registered for this competition in this city');
    }

    // Create participation
    const [result] = await db.execute(
      'INSERT INTO participations (user_id, competition_id, city_id, source) VALUES (?, ?, ?, ?)',
      [userId, competitionId, cityId, 'USER_SELF']
    );

    const participationId = result.insertId;

    // Auto-add to Round 1 if it exists
    try {
      const [round1] = await db.execute(
        'SELECT id FROM rounds WHERE competition_id = ? AND city_id = ? AND round_number = 1',
        [competitionId, cityId]
      );
      if (round1.length > 0) {
        await db.execute(
          'INSERT INTO round_participations (round_id, participation_id, qualified_by) VALUES (?, ?, ?)',
          [round1[0].id, participationId, 'AUTOMATIC']
        );
      }
    } catch (err) {
      // Silently ignore if rounds table doesn't exist yet
      console.log('Note: Could not add to round 1:', err.message);
    }

    return {
      id: participationId,
      competition_id: competitionId,
      city_id: cityId,
      registered_at: new Date()
    };
  }

  // Get user's registrations
  async getUserRegistrations(userId) {
    const db = getPool();
    const [registrations] = await db.execute(`
      SELECT 
        p.id,
        p.registered_at,
        p.source,
        c.id as competition_id,
        c.name as competition_name,
        c.start_date,
        c.end_date,
        c.status as competition_status,
        ci.id as city_id,
        ci.name as city_name,
        cc.event_date,
        r.result_status,
        r.position
      FROM participations p
      JOIN competitions c ON p.competition_id = c.id
      JOIN cities ci ON p.city_id = ci.id
      LEFT JOIN competition_cities cc ON cc.competition_id = c.id AND cc.city_id = ci.id
      LEFT JOIN results r ON r.participation_id = p.id
      WHERE p.user_id = ?
      ORDER BY p.registered_at DESC
    `, [userId]);

    // Get round-based positions for each registration
    for (const reg of registrations) {
      const [roundScores] = await db.execute(`
        SELECT 
          rd.name as round_name,
          rd.is_finale,
          rs.score,
          rs.rank_in_round,
          rs.is_winner,
          rs.winner_position
        FROM round_participations rp
        JOIN rounds rd ON rd.id = rp.round_id
        LEFT JOIN round_scores rs ON rs.round_participation_id = rp.id
        WHERE rp.participation_id = ?
        ORDER BY rd.round_number DESC
        LIMIT 1
      `, [reg.id]);

      if (roundScores.length > 0) {
        const latestRound = roundScores[0];
        reg.latest_round = latestRound.round_name;
        reg.latest_score = latestRound.score;
        reg.latest_rank = latestRound.rank_in_round;
        reg.is_winner = latestRound.is_winner;
        reg.winner_position = latestRound.winner_position;
      }
    }

    return registrations;
  }

  // Get active cities for filter dropdown
  async getActiveCities() {
    const db = getPool();
    const [cities] = await db.execute(`
      SELECT id, name
      FROM cities
      WHERE status = 'ACTIVE'
      ORDER BY name ASC
    `);
    return cities;
  }
}

module.exports = new CompetitionService();
