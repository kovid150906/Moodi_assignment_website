const { getPool } = require('../config/database');

class CompetitionService {
    // Get all competitions (for admin view)
    async getAllCompetitions(filters = {}) {
        const db = getPool();
        let query = `
      SELECT 
        c.id,
        c.name,
        c.description,
        c.registration_open,
        c.status,
        c.created_at,
        (SELECT COUNT(*) FROM participations p WHERE p.competition_id = c.id) as participant_count
      FROM competitions c
      WHERE 1=1
    `;
        const params = [];

        if (filters.status) {
            query += ' AND c.status = ?';
            params.push(filters.status);
        }

        query += ' ORDER BY c.created_at DESC';

        const [competitions] = await db.execute(query, params);

        // Get cities with event dates for each competition
        for (const comp of competitions) {
            const [cities] = await db.execute(`
        SELECT cc.id, cc.event_date, cc.registration_open as city_registration_open, ci.id as city_id, ci.name as city_name
        FROM competition_cities cc
        JOIN cities ci ON cc.city_id = ci.id
        WHERE cc.competition_id = ?
        ORDER BY cc.event_date ASC
      `, [comp.id]);
            comp.cities = cities;
        }

        return competitions;
    }

    // Get competition by ID
    async getCompetitionById(id) {
        const db = getPool();
        const [competitions] = await db.execute(`
      SELECT 
        c.id,
        c.name,
        c.description,
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

        // Get cities with event dates
        const [cities] = await db.execute(`
      SELECT cc.id, cc.event_date, cc.registration_open as city_registration_open, ci.id as city_id, ci.name as city_name
      FROM competition_cities cc
      JOIN cities ci ON cc.city_id = ci.id
      WHERE cc.competition_id = ?
      ORDER BY cc.event_date ASC
    `, [id]);

        competition.cities = cities;

        // Get participant count by city
        const [stats] = await db.execute(`
      SELECT 
        ci.name as city_name,
        COUNT(*) as count
      FROM participations p
      JOIN cities ci ON p.city_id = ci.id
      WHERE p.competition_id = ?
      GROUP BY ci.id, ci.name
    `, [id]);

        competition.participantStats = stats;

        return competition;
    }

    // Create competition without cities (cities added separately)
    async createCompetition(data) {
        const db = getPool();

        // Create competition (starts in DRAFT status, registration closed)
        const [result] = await db.execute(
            `INSERT INTO competitions (name, description, registration_open, status)
         VALUES (?, ?, FALSE, 'DRAFT')`,
            [data.name, data.description || '']
        );

        const competitionId = result.insertId;

        return { 
            id: competitionId, 
            name: data.name,
            description: data.description || '',
            status: 'DRAFT',
            registration_open: false
        };
    }

    // Update competition
    async updateCompetition(id, data) {
        const db = getPool();
        const fields = [];
        const params = [];

        if (data.name !== undefined) {
            fields.push('name = ?');
            params.push(data.name);
        }
        if (data.description !== undefined) {
            fields.push('description = ?');
            params.push(data.description);
        }
        if (data.registration_open !== undefined) {
            fields.push('registration_open = ?');
            params.push(data.registration_open);
        }
        if (data.status !== undefined) {
            fields.push('status = ?');
            params.push(data.status);
        }

        if (fields.length === 0) {
            throw new Error('No fields to update');
        }

        params.push(id);

        await db.execute(
            `UPDATE competitions SET ${fields.join(', ')} WHERE id = ?`,
            params
        );
    }

    // Update competition status with workflow validation
    // Status represents the competition phase: DRAFT -> ACTIVE -> COMPLETED
    // Registration is controlled separately via toggleRegistration()
    async updateStatus(id, newStatus) {
        const db = getPool();
        const [competitions] = await db.execute(
            'SELECT id, status, registration_open FROM competitions WHERE id = ?',
            [id]
        );

        if (competitions.length === 0) {
            throw new Error('Competition not found');
        }

        const current = competitions[0];

        // Status workflow validation (competition phase)
        const validTransitions = {
            'DRAFT': ['ACTIVE', 'CANCELLED'],
            'ACTIVE': ['COMPLETED', 'CANCELLED'],
            'COMPLETED': ['ARCHIVED'],
            'CANCELLED': [],
            'ARCHIVED': []
        };

        if (!validTransitions[current.status]?.includes(newStatus)) {
            throw new Error(`Cannot transition from ${current.status} to ${newStatus}`);
        }

        await db.execute(
            'UPDATE competitions SET status = ? WHERE id = ?',
            [newStatus, id]
        );

        return { status: newStatus, registration_open: current.registration_open };
    }

    // Toggle registration open/closed (independent of status)
    async toggleRegistration(id, isOpen) {
        const db = getPool();
        const [competitions] = await db.execute(
            'SELECT id, status FROM competitions WHERE id = ?',
            [id]
        );

        if (competitions.length === 0) {
            throw new Error('Competition not found');
        }

        const current = competitions[0];

        // Can only toggle registration for DRAFT or ACTIVE competitions
        if (!['DRAFT', 'ACTIVE'].includes(current.status)) {
            throw new Error('Cannot change registration for completed/cancelled competitions');
        }

        await db.execute(
            'UPDATE competitions SET registration_open = ? WHERE id = ?',
            [isOpen, id]
        );

        return { registration_open: isOpen };
    }

    // Delete competition (ADMIN only)
    async deleteCompetition(id) {
        const db = getPool();
        const [competitions] = await db.execute(
            'SELECT id FROM competitions WHERE id = ?',
            [id]
        );

        if (competitions.length === 0) {
            throw new Error('Competition not found');
        }

        // Check for participations
        const [participations] = await db.execute(
            'SELECT COUNT(*) as count FROM participations WHERE competition_id = ?',
            [id]
        );

        if (participations[0].count > 0) {
            throw new Error('Cannot delete competition with existing participants');
        }

        await db.execute('DELETE FROM competitions WHERE id = ?', [id]);
    }

    // Get all cities
    async getAllCities() {
        const db = getPool();
        const [cities] = await db.execute(
            'SELECT id, name, status FROM cities WHERE status = ? ORDER BY name',
            ['ACTIVE']
        );
        return cities;
    }

    // Create new city
    async createCity(name) {
        const db = getPool();
        
        // Check if city already exists
        const [existing] = await db.execute(
            'SELECT id FROM cities WHERE LOWER(name) = LOWER(?)',
            [name]
        );

        if (existing.length > 0) {
            throw new Error('City already exists');
        }

        const [result] = await db.execute(
            'INSERT INTO cities (name, status) VALUES (?, ?)',
            [name, 'ACTIVE']
        );

        return {
            id: result.insertId,
            name: name,
            status: 'ACTIVE'
        };
    }

    // Add city to competition (Create Branch)
    async addCity(competitionId, cityId, eventDate) {
        const db = getPool();

        // Verify city exists
        const [cities] = await db.execute('SELECT id FROM cities WHERE id = ?', [cityId]);
        if (cities.length === 0) throw new Error('City not found');

        // Verify not already added
        const [existing] = await db.execute(
            'SELECT id FROM competition_cities WHERE competition_id = ? AND city_id = ?',
            [competitionId, cityId]
        );

        if (existing.length > 0) throw new Error('City already added to this competition');

        const [result] = await db.execute(
            'INSERT INTO competition_cities (competition_id, city_id, event_date) VALUES (?, ?, ?)',
            [competitionId, cityId, eventDate || null]
        );

        return { id: result.insertId };
    }

    // Remove city from competition
    async removeCity(competitionId, cityId) {
        const db = getPool();
        
        // Check if city is associated with competition
        const [cities] = await db.execute(
            'SELECT id FROM competition_cities WHERE competition_id = ? AND city_id = ?',
            [competitionId, cityId]
        );

        if (cities.length === 0) {
            throw new Error('City not associated with this competition');
        }

        // Check if there are participants in this city
        const [participants] = await db.execute(
            'SELECT COUNT(*) as count FROM participations WHERE competition_id = ? AND city_id = ?',
            [competitionId, cityId]
        );

        if (participants[0].count > 0) {
            throw new Error('Cannot remove city with existing participants');
        }

        // Check if there are rounds for this city
        const [rounds] = await db.execute(
            'SELECT COUNT(*) as count FROM rounds WHERE competition_id = ? AND city_id = ?',
            [competitionId, cityId]
        );

        if (rounds[0].count > 0) {
            throw new Error('Cannot remove city with existing rounds');
        }

        await db.execute(
            'DELETE FROM competition_cities WHERE competition_id = ? AND city_id = ?',
            [competitionId, cityId]
        );
    }

    // Update city event date
    async updateCityEventDate(competitionId, cityId, eventDate) {
        const db = getPool();
        
        const [cities] = await db.execute(
            'SELECT id FROM competition_cities WHERE competition_id = ? AND city_id = ?',
            [competitionId, cityId]
        );

        if (cities.length === 0) {
            throw new Error('City not associated with this competition');
        }

        await db.execute(
            'UPDATE competition_cities SET event_date = ? WHERE competition_id = ? AND city_id = ?',
            [eventDate || null, competitionId, cityId]
        );
    }

    // Add participant manually (bypasses registration_open check)
    async addParticipant(userId, competitionId, cityId) {
        const db = getPool();
        // Verify user exists
        const [users] = await db.execute('SELECT id FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            throw new Error('User not found');
        }

        // Verify competition exists
        const [competitions] = await db.execute('SELECT id FROM competitions WHERE id = ?', [competitionId]);
        if (competitions.length === 0) {
            throw new Error('Competition not found');
        }

        // Verify city is valid for competition
        const [cities] = await db.execute(
            'SELECT id FROM competition_cities WHERE competition_id = ? AND city_id = ?',
            [competitionId, cityId]
        );
        if (cities.length === 0) {
            throw new Error('Invalid city for this competition');
        }

        // Check for duplicate (same user, same competition, same city)
        const [existing] = await db.execute(
            'SELECT id FROM participations WHERE user_id = ? AND competition_id = ? AND city_id = ?',
            [userId, competitionId, cityId]
        );
        if (existing.length > 0) {
            throw new Error('User already registered for this competition in this city');
        }

        // Add participation with ADMIN_ADDED source
        const [result] = await db.execute(
            'INSERT INTO participations (user_id, competition_id, city_id, source) VALUES (?, ?, ?, ?)',
            [userId, competitionId, cityId, 'ADMIN_ADDED']
        );

        return { id: result.insertId };
    }

    // Get participants for competition
    async getParticipants(competitionId) {
        const db = getPool();
        const [participants] = await db.execute(`
      SELECT 
        p.id,
        p.registered_at,
        p.source,
        u.id as user_id,
        u.mi_id,
        u.full_name,
        u.email,
        ci.name as city_name,
        r.id as result_id,
        r.result_status,
        r.position,
        r.locked
      FROM participations p
      JOIN users u ON p.user_id = u.id
      JOIN cities ci ON p.city_id = ci.id
      LEFT JOIN results r ON r.participation_id = p.id
      WHERE p.competition_id = ?
      ORDER BY p.registered_at DESC
    `, [competitionId]);

        return participants;
    }

    // Get full competition dashboard data
    async getCompetitionDashboard(competitionId) {
        const db = getPool();
        
        // Get competition basic info
        const competition = await this.getCompetitionById(competitionId);
        if (!competition) {
            throw new Error('Competition not found');
        }

        // Get rounds grouped by city
        const [rounds] = await db.execute(`
            SELECT 
                r.id,
                r.city_id,
                c.name as city_name,
                r.round_number,
                r.name,
                r.is_finale,
                r.status,
                (SELECT COUNT(*) FROM round_participations rp WHERE rp.round_id = r.id) as participant_count,
                (SELECT COUNT(*) FROM round_participations rp 
                 JOIN round_scores rs ON rs.round_participation_id = rp.id 
                 WHERE rp.round_id = r.id AND rs.score IS NOT NULL) as scored_count
            FROM rounds r
            JOIN cities c ON c.id = r.city_id
            WHERE r.competition_id = ?
            ORDER BY c.name, r.round_number
        `, [competitionId]);

        // Get winners from all finales
        const [winners] = await db.execute(`
            SELECT 
                u.id as user_id,
                u.mi_id,
                u.full_name,
                u.email,
                c.name as city_name,
                r.name as round_name,
                rs.winner_position as position,
                rs.score
            FROM round_scores rs
            JOIN round_participations rp ON rp.id = rs.round_participation_id
            JOIN rounds r ON r.id = rp.round_id
            JOIN participations p ON p.id = rp.participation_id
            JOIN users u ON u.id = p.user_id
            JOIN cities c ON c.id = p.city_id
            WHERE r.competition_id = ? AND r.is_finale = TRUE AND rs.is_winner = TRUE
            ORDER BY c.name, rs.winner_position
        `, [competitionId]);

        // Group rounds by city
        const roundsByCity = {};
        for (const round of rounds) {
            if (!roundsByCity[round.city_name]) {
                roundsByCity[round.city_name] = { city_id: round.city_id, rounds: [], winners: [] };
            }
            roundsByCity[round.city_name].rounds.push(round);
        }

        // Add winners to their cities
        for (const winner of winners) {
            if (roundsByCity[winner.city_name]) {
                roundsByCity[winner.city_name].winners.push(winner);
            }
        }

        // Calculate stats
        const stats = {
            total_participants: 0,
            total_cities: Object.keys(roundsByCity).length,
            total_rounds: rounds.length,
            total_winners: winners.length,
            cities_completed: 0
        };

        for (const city of Object.values(roundsByCity)) {
            const finale = city.rounds.find(r => r.is_finale);
            if (finale?.status === 'COMPLETED') {
                stats.cities_completed++;
            }
        }

        const [participantCount] = await db.execute(
            'SELECT COUNT(*) as count FROM participations WHERE competition_id = ?',
            [competitionId]
        );
        stats.total_participants = participantCount[0].count;

        return {
            ...competition,
            rounds_by_city: roundsByCity,
            all_winners: winners,
            stats
        };
    }
}

module.exports = new CompetitionService();
