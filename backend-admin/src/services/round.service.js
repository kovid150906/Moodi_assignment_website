const { getPool } = require('../config/database');

class RoundService {
    // Create a round for a competition-city pair
    async createRound(data) {
        const db = getPool();
        const { competition_id, city_id, round_number, name, round_date, is_finale } = data;

        // Validate competition and city exist
        const [competitions] = await db.execute(
            'SELECT id FROM competitions WHERE id = ?',
            [competition_id]
        );
        if (competitions.length === 0) {
            throw new Error('Competition not found');
        }

        // Check if a finale already exists for this city-competition (if trying to create another one)
        if (is_finale) {
            const [existingFinale] = await db.execute(
                `SELECT id, name FROM rounds 
                 WHERE competition_id = ? AND city_id = ? AND is_finale = TRUE`,
                [competition_id, city_id]
            );
            if (existingFinale.length > 0) {
                throw new Error(`A finale already exists for this city: "${existingFinale[0].name}". Only one finale per city is allowed.`);
            }
        }

        // Get default date from competition_cities if not provided
        let finalRoundDate = round_date;
        if (!finalRoundDate) {
            const [cityData] = await db.execute(
                'SELECT event_date FROM competition_cities WHERE competition_id = ? AND city_id = ?',
                [competition_id, city_id]
            );
            if (cityData.length > 0) {
                finalRoundDate = cityData[0].event_date;
            }
        }

        // Create round
        const [result] = await db.execute(
            `INSERT INTO rounds (competition_id, city_id, round_number, name, round_date, is_finale)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [competition_id, city_id, round_number, name, finalRoundDate, is_finale || false]
        );

        // If this is Round 1, auto-enroll all existing participations for this competition-city
        if (round_number === 1) {
            await db.execute(
                `INSERT INTO round_participations (round_id, participation_id, qualified_by)
                 SELECT ?, p.id, 'AUTOMATIC'
                 FROM participations p
                 WHERE p.competition_id = ? AND p.city_id = ?
                 AND NOT EXISTS (
                     SELECT 1 FROM round_participations rp WHERE rp.round_id = ? AND rp.participation_id = p.id
                 )`,
                [result.insertId, competition_id, city_id, result.insertId]
            );
        }

        return { id: result.insertId, ...data, round_date: finalRoundDate };
    }

    // Get all rounds for a competition (grouped by city)
    async getRoundsByCompetition(competitionId) {
        const db = getPool();
        const [rounds] = await db.execute(
            `SELECT 
                r.id,
                r.competition_id,
                r.city_id,
                c.name as city_name,
                r.round_number,
                r.name,
                r.round_date,
                r.is_finale,
                r.status,
                r.created_at,
                (SELECT COUNT(*) FROM round_participations rp WHERE rp.round_id = r.id) as participant_count,
                (SELECT COUNT(*) FROM round_participations rp 
                 JOIN round_scores rs ON rs.round_participation_id = rp.id 
                 WHERE rp.round_id = r.id AND rs.score IS NOT NULL) as scored_count
            FROM rounds r
            JOIN cities c ON c.id = r.city_id
            WHERE r.competition_id = ?
            ORDER BY c.name, r.round_number`,
            [competitionId]
        );
        return rounds;
    }

    // Get round details with all participants and scores
    async getRoundDetails(roundId) {
        const db = getPool();

        // Get round info
        const [rounds] = await db.execute(
            `SELECT 
                r.*,
                c.name as city_name,
                comp.name as competition_name
            FROM rounds r
            JOIN cities c ON c.id = r.city_id
            JOIN competitions comp ON comp.id = r.competition_id
            WHERE r.id = ?`,
            [roundId]
        );

        if (rounds.length === 0) {
            throw new Error('Round not found');
        }

        const round = rounds[0];

        // Get participants with scores
        const [participants] = await db.execute(
            `SELECT 
                rp.id as round_participation_id,
                rp.participation_id,
                rp.qualified_by,
                rp.created_at as joined_at,
                u.id as user_id,
                u.mi_id,
                u.full_name,
                u.email,
                rs.id as score_id,
                rs.score,
                rs.rank_in_round,
                rs.is_winner,
                rs.winner_position,
                rs.notes,
                rs.updated_at as scored_at
            FROM round_participations rp
            JOIN participations p ON p.id = rp.participation_id
            JOIN users u ON u.id = p.user_id
            LEFT JOIN round_scores rs ON rs.round_participation_id = rp.id
            WHERE rp.round_id = ?
            ORDER BY rs.score DESC, u.full_name`,
            [roundId]
        );

        round.participants = participants;
        
        // Add counts for frontend
        round.participant_count = participants.length;
        round.scored_count = participants.filter(p => p.score !== null).length;
        
        return round;
    }

    // Upload scores from CSV data
    // Expected format: [{ email, score, notes }]
    async uploadScores(roundId, scoresData, adminId) {
        const db = getPool();

        // Get round info
        const [rounds] = await db.execute(
            'SELECT competition_id, city_id FROM rounds WHERE id = ?',
            [roundId]
        );
        if (rounds.length === 0) {
            throw new Error('Round not found');
        }

        const { competition_id, city_id } = rounds[0];
        const results = { success: 0, skipped: 0, failed: 0, errors: [] };

        for (const row of scoresData) {
            try {
                // Find participation by email or mi_id
                let participations;
                let identifier;
                
                if (row.mi_id) {
                    identifier = row.mi_id;
                    [participations] = await db.execute(
                        `SELECT rp.id as round_participation_id
                         FROM round_participations rp
                         JOIN participations p ON p.id = rp.participation_id
                         JOIN users u ON u.id = p.user_id
                         WHERE rp.round_id = ? AND u.mi_id = ?`,
                        [roundId, row.mi_id]
                    );
                } else if (row.email) {
                    identifier = row.email;
                    [participations] = await db.execute(
                        `SELECT rp.id as round_participation_id
                         FROM round_participations rp
                         JOIN participations p ON p.id = rp.participation_id
                         JOIN users u ON u.id = p.user_id
                         WHERE rp.round_id = ? AND u.email = ?`,
                        [roundId, row.email]
                    );
                } else {
                    results.failed++;
                    results.errors.push('Row missing both email and mi_id');
                    continue;
                }

                if (participations.length === 0) {
                    results.failed++;
                    results.errors.push(`Not found in this round: ${identifier}`);
                    continue;
                }

                const rpId = participations[0].round_participation_id;

                // Check if score already exists
                const [existingScores] = await db.execute(
                    'SELECT id FROM round_scores WHERE round_participation_id = ?',
                    [rpId]
                );

                if (existingScores.length > 0) {
                    // Skip - score already exists
                    results.skipped++;
                    continue;
                }

                // Insert new score only
                await db.execute(
                    `INSERT INTO round_scores (round_participation_id, score, notes, scored_by_admin_id)
                     VALUES (?, ?, ?, ?)`,
                    [rpId, row.score, row.notes || null, adminId]
                );

                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push(`Error for ${row.email}: ${error.message}`);
            }
        }

        // Recalculate ranks
        await this.recalculateRanks(roundId);

        return results;
    }

    // Clear all scores for a round (ADMIN only)
    async clearScores(roundId, adminId) {
        const db = getPool();

        // Verify round exists
        const [rounds] = await db.execute(
            'SELECT id FROM rounds WHERE id = ?',
            [roundId]
        );
        if (rounds.length === 0) {
            throw new Error('Round not found');
        }

        // Get all round_participation IDs for this round
        const [participations] = await db.execute(
            'SELECT id FROM round_participations WHERE round_id = ?',
            [roundId]
        );

        if (participations.length === 0) {
            return { deletedCount: 0 };
        }

        // Delete scores for these participations
        const participationIds = participations.map(p => p.id);
        const placeholders = participationIds.map(() => '?').join(',');
        
        const [result] = await db.execute(
            `DELETE FROM round_scores WHERE round_participation_id IN (${placeholders})`,
            participationIds
        );

        return { deletedCount: result.affectedRows };
    }

    // Recalculate ranks for a round based on scores
    async recalculateRanks(roundId) {
        const db = getPool();

        // Get all scores ordered
        const [scores] = await db.execute(
            `SELECT rs.id, rs.score
             FROM round_scores rs
             JOIN round_participations rp ON rp.id = rs.round_participation_id
             WHERE rp.round_id = ? AND rs.score IS NOT NULL
             ORDER BY rs.score DESC`,
            [roundId]
        );

        // Update ranks
        let rank = 1;
        for (const score of scores) {
            await db.execute(
                'UPDATE round_scores SET rank_in_round = ? WHERE id = ?',
                [rank, score.id]
            );
            rank++;
        }
    }

    // Promote top X participants to next round
    async promoteToNextRound(roundId, count, adminId) {
        const db = getPool();

        // Validate and convert parameters
        const validRoundId = parseInt(roundId);
        const validCount = parseInt(count);
        const validAdminId = adminId ? parseInt(adminId) : null;

        if (!validRoundId || validRoundId < 1) {
            throw new Error('Invalid round ID');
        }
        if (!validCount || validCount < 1) {
            throw new Error('Count must be a positive number');
        }

        // Get current round info
        const [rounds] = await db.execute(
            'SELECT * FROM rounds WHERE id = ?',
            [validRoundId]
        );
        if (rounds.length === 0) {
            throw new Error('Round not found');
        }

        const currentRound = rounds[0];

        // Check if next round exists
        const [nextRounds] = await db.execute(
            `SELECT id FROM rounds 
             WHERE competition_id = ? AND city_id = ? AND round_number = ?`,
            [currentRound.competition_id, currentRound.city_id, currentRound.round_number + 1]
        );

        if (nextRounds.length === 0) {
            throw new Error('Next round does not exist. Please create it first.');
        }

        const nextRoundId = nextRounds[0].id;

        // Get top X participants by score
        // Note: Using validCount directly after validation since LIMIT doesn't work well with placeholders in some MySQL versions
        const [topParticipants] = await db.execute(
            `SELECT rp.participation_id
             FROM round_participations rp
             JOIN round_scores rs ON rs.round_participation_id = rp.id
             WHERE rp.round_id = ?
             ORDER BY rs.score DESC
             LIMIT ${validCount}`,
            [validRoundId]
        );

        let promoted = 0;
        for (const p of topParticipants) {
            try {
                await db.execute(
                    `INSERT INTO round_participations (round_id, participation_id, qualified_by, added_by_admin_id)
                     VALUES (?, ?, 'AUTOMATIC', ?)
                     ON DUPLICATE KEY UPDATE round_id = round_id`,
                    [nextRoundId, p.participation_id, validAdminId]
                );
                promoted++;
            } catch (error) {
                // Ignore duplicates
                console.log('Duplicate or error:', error.message);
            }
        }

        // Mark current round as completed
        await db.execute(
            'UPDATE rounds SET status = ? WHERE id = ?',
            ['COMPLETED', validRoundId]
        );

        return { promoted, next_round_id: nextRoundId };
    }

    // Manually add a participant to a round
    async addParticipantToRound(roundId, participationId, adminId) {
        const db = getPool();

        // Verify participation exists
        const [participations] = await db.execute(
            'SELECT id FROM participations WHERE id = ?',
            [participationId]
        );
        if (participations.length === 0) {
            throw new Error('Participation not found');
        }

        await db.execute(
            `INSERT INTO round_participations (round_id, participation_id, qualified_by, added_by_admin_id)
             VALUES (?, ?, 'MANUAL', ?)`,
            [roundId, participationId, adminId]
        );

        return { success: true };
    }

    // Remove a participant from a round
    async removeParticipantFromRound(roundId, participationId) {
        const db = getPool();

        // Get round_participation_id
        const [rp] = await db.execute(
            'SELECT id FROM round_participations WHERE round_id = ? AND participation_id = ?',
            [roundId, participationId]
        );

        if (rp.length === 0) {
            throw new Error('Participant not found in this round');
        }

        const roundParticipationId = rp[0].id;

        // Delete associated score first (if exists)
        await db.execute(
            'DELETE FROM round_scores WHERE round_participation_id = ?',
            [roundParticipationId]
        );

        // Delete round participation
        await db.execute(
            'DELETE FROM round_participations WHERE id = ?',
            [roundParticipationId]
        );

        return { success: true };
    }

    // Update individual score
    async updateScore(roundParticipationId, score, notes, adminId) {
        const db = getPool();

        await db.execute(
            `INSERT INTO round_scores (round_participation_id, score, notes, scored_by_admin_id)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
                score = VALUES(score), 
                notes = VALUES(notes),
                scored_by_admin_id = VALUES(scored_by_admin_id),
                updated_at = CURRENT_TIMESTAMP`,
            [roundParticipationId, score, notes, adminId]
        );

        // Get round_id to recalculate ranks
        const [rps] = await db.execute(
            'SELECT round_id FROM round_participations WHERE id = ?',
            [roundParticipationId]
        );
        if (rps.length > 0) {
            await this.recalculateRanks(rps[0].round_id);
        }

        return { success: true };
    }

    // Select winners for finale round
    async selectWinners(roundId, winners, adminId) {
        const db = getPool();

        // Verify this is a finale round and get competition/city info
        const [rounds] = await db.execute(
            'SELECT is_finale, competition_id, city_id FROM rounds WHERE id = ?',
            [roundId]
        );
        if (rounds.length === 0 || !rounds[0].is_finale) {
            throw new Error('This is not a finale round');
        }
        const { competition_id, city_id } = rounds[0];

        // First, reset ALL is_winner flags for this round to FALSE
        await db.execute(
            `UPDATE round_scores rs
             JOIN round_participations rp ON rp.id = rs.round_participation_id
             SET rs.is_winner = FALSE, rs.winner_position = NULL
             WHERE rp.round_id = ?`,
            [roundId]
        );

        // winners is array of { round_participation_id, position }
        // Only mark the selected participants as winners
        for (const winner of winners) {
            await db.execute(
                `UPDATE round_scores 
                 SET is_winner = TRUE, winner_position = ?, scored_by_admin_id = ?
                 WHERE round_participation_id = ?`,
                [winner.position, adminId, winner.round_participation_id]
            );
        }

        // Mark round as completed
        await db.execute(
            'UPDATE rounds SET status = ? WHERE id = ?',
            ['COMPLETED', roundId]
        );

        // Auto-close registration for this city (since we're selecting finale winners)
        await db.execute(
            `UPDATE competition_cities 
             SET registration_open = FALSE 
             WHERE competition_id = ? AND city_id = ?`,
            [competition_id, city_id]
        );
        console.log(`Closed registration for competition ${competition_id}, city ${city_id}`);

        // Delete existing results and insert finale winners into results table
        await db.execute(
            `DELETE r FROM results r
             JOIN participations p ON p.id = r.participation_id
             WHERE p.competition_id = ? AND p.city_id = ?`,
            [competition_id, city_id]
        );

        // Get finale winners and insert into results (position 1 = WINNER, rest = FINALIST)
        const [finaleWinners] = await db.execute(
            `SELECT p.id as participation_id, rs.winner_position as position
             FROM round_participations rp
             JOIN rounds r ON r.id = rp.round_id
             JOIN participations p ON p.id = rp.participation_id
             JOIN round_scores rs ON rs.round_participation_id = rp.id
             WHERE r.id = ? AND rs.is_winner = TRUE
             ORDER BY rs.winner_position`,
            [roundId]
        );

        for (const winner of finaleWinners) {
            const resultStatus = winner.position === 1 ? 'WINNER' : 'FINALIST';
            await db.execute(
                `INSERT INTO results (participation_id, result_status, position)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE result_status = VALUES(result_status), position = VALUES(position)`,
                [winner.participation_id, resultStatus, winner.position]
            );
        }

        return { success: true, winners_count: winners.length };
    }

    // Get leaderboard for a round
    async getRoundLeaderboard(roundId) {
        const db = getPool();

        const [participants] = await db.execute(
            `SELECT 
                u.full_name,
                u.email,
                u.mi_id,
                c.name as city_name,
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
            ORDER BY rs.score DESC, u.full_name`,
            [roundId]
        );

        return participants;
    }

    // Update round details (name, date, status)
    async updateRound(roundId, data) {
        const db = getPool();
        
        // Get round info first (needed for finale validation)
        const [rounds] = await db.execute(
            'SELECT id, competition_id, city_id FROM rounds WHERE id = ?',
            [roundId]
        );
        if (rounds.length === 0) {
            throw new Error('Round not found');
        }
        const round = rounds[0];
        
        const fields = [];
        const params = [];

        if (data.name !== undefined) {
            fields.push('name = ?');
            params.push(data.name);
        }
        if (data.round_date !== undefined) {
            fields.push('round_date = ?');
            params.push(data.round_date);
        }
        if (data.status !== undefined) {
            fields.push('status = ?');
            params.push(data.status);
        }
        if (data.is_finale !== undefined) {
            // Check if setting to finale and another finale already exists
            if (data.is_finale === true) {
                const [existingFinale] = await db.execute(
                    `SELECT id, name FROM rounds 
                     WHERE competition_id = ? AND city_id = ? AND is_finale = TRUE AND id != ?`,
                    [round.competition_id, round.city_id, roundId]
                );
                if (existingFinale.length > 0) {
                    throw new Error(`A finale already exists for this city: "${existingFinale[0].name}". Only one finale per city is allowed.`);
                }
            }
            fields.push('is_finale = ?');
            params.push(data.is_finale);
        }

        if (fields.length === 0) {
            throw new Error('No fields to update');
        }

        params.push(roundId);
        await db.execute(
            `UPDATE rounds SET ${fields.join(', ')} WHERE id = ?`,
            params
        );

        return this.getRoundDetails(roundId);
    }

    // Delete a round and all its data (scores, participations)
    async deleteRound(roundId) {
        const db = getPool();

        // Check if round exists
        const [rounds] = await db.execute(
            'SELECT id, competition_id, city_id, round_number, status FROM rounds WHERE id = ?',
            [roundId]
        );
        if (rounds.length === 0) {
            throw new Error('Round not found');
        }

        const round = rounds[0];

        // Check if there are subsequent rounds that depend on this one
        const [subsequentRounds] = await db.execute(
            `SELECT id FROM rounds 
             WHERE competition_id = ? AND city_id = ? AND round_number > ?`,
            [round.competition_id, round.city_id, round.round_number]
        );

        if (subsequentRounds.length > 0) {
            throw new Error('Cannot delete round with subsequent rounds. Delete later rounds first.');
        }

        // Delete in order: scores -> round_participations -> round
        await db.execute(
            `DELETE rs FROM round_scores rs
             JOIN round_participations rp ON rp.id = rs.round_participation_id
             WHERE rp.round_id = ?`,
            [roundId]
        );

        await db.execute(
            'DELETE FROM round_participations WHERE round_id = ?',
            [roundId]
        );

        await db.execute(
            'DELETE FROM rounds WHERE id = ?',
            [roundId]
        );

        return { deleted: true, round_id: roundId };
    }

    // Archive a round (keeps data but marks as archived)
    async archiveRound(roundId) {
        const db = getPool();

        const [rounds] = await db.execute(
            'SELECT id, status FROM rounds WHERE id = ?',
            [roundId]
        );
        if (rounds.length === 0) {
            throw new Error('Round not found');
        }

        await db.execute(
            'UPDATE rounds SET status = ? WHERE id = ?',
            ['ARCHIVED', roundId]
        );

        return { archived: true, round_id: roundId };
    }

    // Unarchive a round (restore to PENDING status)
    async unarchiveRound(roundId) {
        const db = getPool();

        const [rounds] = await db.execute(
            'SELECT id, status FROM rounds WHERE id = ?',
            [roundId]
        );
        if (rounds.length === 0) {
            throw new Error('Round not found');
        }

        if (rounds[0].status !== 'ARCHIVED') {
            throw new Error('Round is not archived');
        }

        await db.execute(
            'UPDATE rounds SET status = ? WHERE id = ?',
            ['PENDING', roundId]
        );

        return { unarchived: true, round_id: roundId };
    }

    // Get participants eligible for manual addition to a round
    async getEligibleParticipants(roundId) {
        const db = getPool();

        // Get round info
        const [rounds] = await db.execute(
            'SELECT competition_id, city_id, round_number FROM rounds WHERE id = ?',
            [roundId]
        );
        if (rounds.length === 0) {
            throw new Error('Round not found');
        }

        const { competition_id, city_id, round_number } = rounds[0];

        if (round_number === 1) {
            // For Round 1, get all registrations not yet in the round
            const [participants] = await db.execute(
                `SELECT p.id as participation_id, u.full_name, u.email, u.mi_id, c.name as city_name
                 FROM participations p
                 JOIN users u ON u.id = p.user_id
                 JOIN cities c ON c.id = p.city_id
                 WHERE p.competition_id = ? AND p.city_id = ?
                 AND NOT EXISTS (
                     SELECT 1 FROM round_participations rp 
                     WHERE rp.round_id = ? AND rp.participation_id = p.id
                 )
                 ORDER BY u.full_name`,
                [competition_id, city_id, roundId]
            );
            return participants;
        } else {
            // For later rounds, get all competition participants not in this round
            // Prioritize those who have won ANY previous round (e.g. city winners for Grand Finale)
            const [participants] = await db.execute(
                `SELECT 
                    p.id as participation_id, 
                    u.full_name, 
                    u.email, 
                    u.mi_id,
                    c.name as city_name, 
                    c.name as city_name,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM round_participations win_rp 
                        JOIN round_scores win_rs ON win_rs.round_participation_id = win_rp.id 
                        WHERE win_rp.participation_id = p.id AND win_rs.is_winner = 1
                    ) THEN 1 ELSE 0 END as is_past_winner
                 FROM participations p
                 JOIN users u ON u.id = p.user_id
                 JOIN cities c ON c.id = p.city_id
                 WHERE p.competition_id = ? 
                 AND NOT EXISTS (
                     SELECT 1 FROM round_participations rp 
                     WHERE rp.round_id = ? AND rp.participation_id = p.id
                 )
                ORDER BY is_past_winner DESC, u.full_name`,
                [competition_id, roundId]
            );
            return participants;
        }
    }

    // Get available winners by city for import
    async getAvailableWinnersForImport(roundId) {
        const db = getPool();

        // Get round info
        const [rounds] = await db.execute('SELECT competition_id, city_id, is_finale, round_number FROM rounds WHERE id = ?', [roundId]);
        if (!rounds.length) throw new Error('Round not found');
        const { competition_id: competitionId, city_id: targetCityId, is_finale: isFinale, round_number: roundNumber } = rounds[0];

        // For finale: get winners from all cities
        // For non-finale: get winners from same city (previous rounds) OR other cities
        let query;
        let params;

        if (isFinale || !targetCityId) {
            // Grand Finale: get winners from ALL cities
            query = `SELECT 
                c.id as city_id,
                c.name as city_name,
                COUNT(DISTINCT p.id) as winner_count,
                GROUP_CONCAT(
                    CONCAT(u.full_name, '|', COALESCE(win_rs.winner_position, win_rs.rank_in_round, 999), '|', COALESCE(win_rs.score, 0), '|', p.id, '|', u.id)
                    ORDER BY COALESCE(win_rs.score, 0) DESC
                    SEPARATOR ';;'
                ) as winners_list
             FROM participations p
             JOIN round_participations win_rp ON win_rp.participation_id = p.id
             JOIN round_scores win_rs ON win_rs.round_participation_id = win_rp.id
             JOIN rounds r ON r.id = win_rp.round_id
             JOIN cities c ON c.id = p.city_id
             JOIN users u ON u.id = p.user_id
             WHERE p.competition_id = ? 
             AND win_rs.is_winner = 1
             AND NOT EXISTS (
                 SELECT 1 FROM round_participations rp 
                 WHERE rp.round_id = ? AND rp.participation_id = p.id
             )
             GROUP BY c.id, c.name
             ORDER BY c.name`;
            params = [competitionId, roundId];
        } else {
            // Non-finale round 2+: get winners from same city's previous rounds
            query = `SELECT 
                c.id as city_id,
                c.name as city_name,
                COUNT(DISTINCT p.id) as winner_count,
                GROUP_CONCAT(
                    CONCAT(u.full_name, '|', COALESCE(win_rs.winner_position, win_rs.rank_in_round, 999), '|', COALESCE(win_rs.score, 0), '|', p.id, '|', u.id)
                    ORDER BY COALESCE(win_rs.score, 0) DESC
                    SEPARATOR ';;'
                ) as winners_list
             FROM participations p
             JOIN round_participations win_rp ON win_rp.participation_id = p.id
             JOIN round_scores win_rs ON win_rs.round_participation_id = win_rp.id
             JOIN rounds r ON r.id = win_rp.round_id
             JOIN cities c ON c.id = p.city_id
             JOIN users u ON u.id = p.user_id
             WHERE p.competition_id = ? 
             AND win_rs.is_winner = 1
             AND p.city_id = ?
             AND r.round_number < ?
             AND NOT EXISTS (
                 SELECT 1 FROM round_participations rp 
                 WHERE rp.round_id = ? AND rp.participation_id = p.id
             )
             GROUP BY c.id, c.name
             ORDER BY c.name`;
            params = [competitionId, targetCityId, roundNumber, roundId];
        }

        const [winners] = await db.execute(query, params);

        // Parse winners list into structured data
        return winners.map(city => {
            const winnersList = city.winners_list ? city.winners_list.split(';;').map(w => {
                const [name, position, score, participationId, userId] = w.split('|');
                return { 
                    full_name: name, 
                    position: parseInt(position), 
                    score: parseFloat(score), 
                    participation_id: parseInt(participationId),
                    user_id: parseInt(userId)
                };
            }) : [];
            return {
                city_id: city.city_id,
                city_name: city.city_name,
                winner_count: city.winner_count,
                winners: winnersList
            };
        });
    }

    // Import selected number of winners from each city
    async importSelectedWinners(roundId, citySelections, adminId) {
        const db = getPool();

        // Get competition info
        const [rounds] = await db.execute('SELECT competition_id FROM rounds WHERE id = ?', [roundId]);
        if (!rounds.length) throw new Error('Round not found');
        const competitionId = rounds[0].competition_id;

        let totalImported = 0;

        for (const selection of citySelections) {
            if (!selection.count || selection.count <= 0) continue;

            // Get top N winners from this city
            const count = parseInt(selection.count, 10);
            // Note: Using count directly after validation since LIMIT doesn't work well with placeholders in some MySQL versions
            const [winners] = await db.execute(
                `SELECT p.id as participation_id, MAX(win_rs.score) as score
                 FROM participations p
                 JOIN round_participations win_rp ON win_rp.participation_id = p.id
                 JOIN round_scores win_rs ON win_rs.round_participation_id = win_rp.id
                 WHERE p.competition_id = ? 
                 AND p.city_id = ?
                 AND win_rs.is_winner = 1
                 AND NOT EXISTS (
                     SELECT 1 FROM round_participations rp 
                     WHERE rp.round_id = ? AND rp.participation_id = p.id
                 )
                 GROUP BY p.id
                 ORDER BY score DESC
                 LIMIT ${count}`,
                [competitionId, selection.city_id, roundId]
            );

            // Insert each winner
            for (const winner of winners) {
                await db.execute(
                    `INSERT INTO round_participations (round_id, participation_id, qualified_by, added_by_admin_id)
                     VALUES (?, ?, 'MANUAL', ?)`,
                    [roundId, winner.participation_id, adminId]
                );
                totalImported++;
            }
        }

        return { imported_count: totalImported };
    }

    // Import all winners from other rounds in this competition (legacy - imports all)
    async importCityWinners(roundId, adminId) {
        const db = getPool();

        // Get competition info
        const [rounds] = await db.execute('SELECT competition_id FROM rounds WHERE id = ?', [roundId]);
        if (!rounds.length) throw new Error('Round not found');
        const competitionId = rounds[0].competition_id;

        // Insert winners
        const [result] = await db.execute(
            `INSERT INTO round_participations (round_id, participation_id, qualified_by, added_by_admin_id)
             SELECT DISTINCT ?, p.id, 'AUTOMATIC', ?
             FROM participations p
             JOIN round_participations win_rp ON win_rp.participation_id = p.id
             JOIN round_scores win_rs ON win_rs.round_participation_id = win_rp.id
             WHERE p.competition_id = ? 
             AND win_rs.is_winner = 1
             AND NOT EXISTS (
                 SELECT 1 FROM round_participations rp 
                 WHERE rp.round_id = ? AND rp.participation_id = p.id
             )`,
            [roundId, adminId, competitionId, roundId]
        );

        return { imported_count: result.affectedRows };
    }

    // Mark a competition-city pair as finished (all rounds completed)
    async markCompetitionCityFinished(competitionId, cityId, adminId) {
        const db = getPool();

        // Check if all rounds for this comp-city pair are completed (excluding archived)
        const [pendingRounds] = await db.execute(
            `SELECT COUNT(*) as count FROM rounds 
             WHERE competition_id = ? AND city_id = ? AND status NOT IN ('COMPLETED', 'ARCHIVED')`,
            [competitionId, cityId]
        );

        if (pendingRounds[0].count > 0) {
            throw new Error(`There are still ${pendingRounds[0].count} incomplete round(s). Complete them first.`);
        }

        // Close registration for this city
        await db.execute(
            `UPDATE competition_cities 
             SET registration_open = FALSE 
             WHERE competition_id = ? AND city_id = ?`,
            [competitionId, cityId]
        );

        // First, delete any existing results for this competition-city (in case of re-selection)
        await db.execute(
            `DELETE r FROM results r
             JOIN participations p ON p.id = r.participation_id
             WHERE p.competition_id = ? AND p.city_id = ?`,
            [competitionId, cityId]
        );

        // Get all finale winners for this competition-city and insert into results table
        // Only participants with is_winner = TRUE will be included
        const [finaleWinners] = await db.execute(
            `SELECT p.id as participation_id, rs.winner_position as position
             FROM round_participations rp
             JOIN rounds r ON r.id = rp.round_id
             JOIN participations p ON p.id = rp.participation_id
             JOIN round_scores rs ON rs.round_participation_id = rp.id
             WHERE r.competition_id = ? AND r.city_id = ? AND r.is_finale = TRUE AND rs.is_winner = TRUE
             ORDER BY rs.winner_position`,
            [competitionId, cityId]
        );

        // Insert/update results - only position 1 is WINNER, rest are FINALIST
        for (const winner of finaleWinners) {
            const resultStatus = winner.position === 1 ? 'WINNER' : 'FINALIST';
            await db.execute(
                `INSERT INTO results (participation_id, result_status, position)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE result_status = VALUES(result_status), position = VALUES(position)`,
                [winner.participation_id, resultStatus, winner.position]
            );
        }

        // Check if ALL cities for this competition are now finished
        const [totalCities] = await db.execute(
            `SELECT COUNT(DISTINCT city_id) as total FROM competition_cities WHERE competition_id = ?`,
            [competitionId]
        );
        const [finishedCities] = await db.execute(
            `SELECT COUNT(DISTINCT r.city_id) as finished FROM rounds r
             WHERE r.competition_id = ? AND r.is_finale = TRUE AND r.status = 'COMPLETED'`,
            [competitionId]
        );

        // If all cities finished, mark competition as COMPLETED
        if (finishedCities[0].finished >= totalCities[0].total) {
            await db.execute(
                `UPDATE competitions SET status = 'COMPLETED' WHERE id = ?`,
                [competitionId]
            );
        }

        return { 
            success: true, 
            winners_added: finaleWinners.length,
            competition_completed: finishedCities[0].finished >= totalCities[0].total
        };
    }

    // Get competition-city status (for showing Mark as Finished button)
    async getCompetitionCityStatus(competitionId, cityId) {
        const db = getPool();

        const [rounds] = await db.execute(
            `SELECT 
                r.id, r.name, r.round_number, r.is_finale, r.status,
                (SELECT COUNT(*) FROM round_participations rp WHERE rp.round_id = r.id) as participants,
                (SELECT COUNT(*) FROM round_participations rp 
                 JOIN round_scores rs ON rs.round_participation_id = rp.id 
                 WHERE rp.round_id = r.id AND rs.is_winner = TRUE) as winners
             FROM rounds r
             WHERE r.competition_id = ? AND r.city_id = ?
             ORDER BY r.round_number`,
            [competitionId, cityId]
        );

        const hasFinale = rounds.some(r => r.is_finale);
        const finaleCompleted = rounds.some(r => r.is_finale && r.status === 'COMPLETED');
        const allRoundsCompleted = rounds.length > 0 && rounds.every(r => r.status === 'COMPLETED');

        // Check if winners already exist in results table for this city
        const [existingResults] = await db.execute(
            `SELECT COUNT(*) as count FROM results r
             JOIN participations p ON p.id = r.participation_id
             WHERE p.competition_id = ? AND p.city_id = ? AND r.result_status = 'WINNER'`,
            [competitionId, cityId]
        );
        const isAlreadyFinished = existingResults[0].count > 0;

        return {
            rounds,
            has_finale: hasFinale,
            finale_completed: finaleCompleted,
            all_rounds_completed: allRoundsCompleted,
            is_finished: isAlreadyFinished,
            can_mark_finished: finaleCompleted && allRoundsCompleted && !isAlreadyFinished
        };
    }

    // Reopen a competition-city (remove results and reset to in progress)
    async reopenCompetitionCity(competitionId, cityId, adminId) {
        const db = getPool();

        // Reopen registration for this city
        await db.execute(
            `UPDATE competition_cities 
             SET registration_open = TRUE 
             WHERE competition_id = ? AND city_id = ?`,
            [competitionId, cityId]
        );

        // Remove winners from results table for this city
        await db.execute(
            `DELETE r FROM results r
             JOIN participations p ON p.id = r.participation_id
             WHERE p.competition_id = ? AND p.city_id = ?`,
            [competitionId, cityId]
        );

        // Reset competition status if it was completed
        await db.execute(
            `UPDATE competitions SET status = 'ACTIVE' WHERE id = ? AND status = 'COMPLETED'`,
            [competitionId]
        );

        return { success: true, message: 'City reopened. Registration reopened and you can now modify rounds and select new winners.' };
    }
}

module.exports = new RoundService();
