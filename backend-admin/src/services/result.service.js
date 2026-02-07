const { getPool } = require('../config/database');

class ResultService {
    // Assign result to participation
    async assignResult(participationId, resultStatus, position = null) {
        const db = getPool();
        // Verify participation exists
        const [participations] = await db.execute(
            'SELECT id FROM participations WHERE id = ?',
            [participationId]
        );

        if (participations.length === 0) {
            throw new Error('Participation not found');
        }

        // Check if result already exists
        const [existing] = await db.execute(
            'SELECT id, locked FROM results WHERE participation_id = ?',
            [participationId]
        );

        if (existing.length > 0) {
            if (existing[0].locked) {
                throw new Error('Result is locked and cannot be modified');
            }

            // Update existing result
            await db.execute(
                'UPDATE results SET result_status = ?, position = ? WHERE participation_id = ?',
                [resultStatus, position, participationId]
            );

            return { id: existing[0].id, updated: true };
        }

        // Create new result
        const [result] = await db.execute(
            'INSERT INTO results (participation_id, result_status, position) VALUES (?, ?, ?)',
            [participationId, resultStatus, position]
        );

        return { id: result.insertId, created: true };
    }

    // Lock result (both ADMIN and COORDINATOR can lock)
    async lockResult(resultId) {
        const db = getPool();
        const [results] = await db.execute(
            'SELECT id FROM results WHERE id = ?',
            [resultId]
        );

        if (results.length === 0) {
            throw new Error('Result not found');
        }

        await db.execute(
            'UPDATE results SET locked = TRUE WHERE id = ?',
            [resultId]
        );
    }

    // Unlock result (ADMIN only)
    async unlockResult(resultId) {
        const db = getPool();
        const [results] = await db.execute(
            'SELECT id FROM results WHERE id = ?',
            [resultId]
        );

        if (results.length === 0) {
            throw new Error('Result not found');
        }

        await db.execute(
            'UPDATE results SET locked = FALSE WHERE id = ?',
            [resultId]
        );
    }

    // Get results for competition
    async getResultsByCompetition(competitionId) {
        const db = getPool();
        const [results] = await db.execute(`
      SELECT 
        r.id,
        r.result_status,
        r.position,
        r.locked,
        r.created_at,
        u.full_name,
        u.email,
        ci.name as city_name
      FROM results r
      JOIN participations p ON r.participation_id = p.id
      JOIN users u ON p.user_id = u.id
      JOIN cities ci ON p.city_id = ci.id
      WHERE p.competition_id = ?
      ORDER BY r.position ASC NULLS LAST, u.full_name ASC
    `, [competitionId]);

        return results;
    }

    // Bulk assign results
    async bulkAssignResults(results) {
        const outcomes = {
            success: [],
            failed: []
        };

        for (const result of results) {
            try {
                const outcome = await this.assignResult(
                    result.participation_id,
                    result.result_status,
                    result.position
                );
                outcomes.success.push({ participation_id: result.participation_id, ...outcome });
            } catch (error) {
                outcomes.failed.push({ participation_id: result.participation_id, error: error.message });
            }
        }

        return outcomes;
    }
}

module.exports = new ResultService();
