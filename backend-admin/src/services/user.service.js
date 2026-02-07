const bcrypt = require('bcryptjs');
const { getPool } = require('../config/database');
const { parse } = require('csv-parse/sync');

class UserService {
    // Get all users with optional filters
    async getAllUsers(filters = {}) {
        const db = getPool();
        let query = 'SELECT id, mi_id, full_name, email, status, created_at FROM users WHERE 1=1';
        const params = [];

        if (filters.status) {
            query += ' AND status = ?';
            params.push(filters.status);
        }

        if (filters.search) {
            query += ' AND (full_name LIKE ? OR email LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }

        query += ' ORDER BY created_at DESC';

        const [users] = await db.execute(query, params);
        return users;
    }

    // Get user by ID with participation history
    async getUserById(userId) {
        const db = getPool();
        const [users] = await db.execute(
            'SELECT id, mi_id, full_name, email, status, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return null;
        }

        const user = users[0];

        // Get participation history
        const [participations] = await db.execute(`
      SELECT 
        p.id,
        p.registered_at,
        p.source,
        c.name as competition_name,
        ci.name as city_name,
        r.result_status,
        r.position
      FROM participations p
      JOIN competitions c ON p.competition_id = c.id
      JOIN cities ci ON p.city_id = ci.id
      LEFT JOIN results r ON r.participation_id = p.id
      WHERE p.user_id = ?
      ORDER BY p.registered_at DESC
    `, [userId]);

        user.participations = participations;
        return user;
    }

    // Create user (ADMIN only)
    async createUser(fullName, email, password, miId) {
        const db = getPool();
        
        if (!miId) {
            throw new Error('MI ID is required');
        }
        
        const [existing] = await db.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            throw new Error('Email already registered');
        }

        // Check if MI ID already exists
        const [existingMiId] = await db.execute(
            'SELECT id FROM users WHERE mi_id = ?',
            [miId]
        );

        if (existingMiId.length > 0) {
            throw new Error('MI ID already registered');
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const [result] = await db.execute(
            'INSERT INTO users (full_name, email, password_hash, mi_id, status) VALUES (?, ?, ?, ?, ?)',
            [fullName, email, passwordHash, miId, 'ACTIVE']
        );

        return {
            id: result.insertId,
            full_name: fullName,
            email,
            mi_id: miId,
            status: 'ACTIVE'
        };
    }

    // Bulk create users from CSV (ADMIN only)
    async bulkCreateUsers(csvContent) {
        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        const results = {
            success: [],
            failed: []
        };

        for (const record of records) {
            try {
                if (!record.full_name || !record.email || !record.password || !record.mi_id) {
                    throw new Error('Missing required fields (full_name, email, password, mi_id)');
                }

                const user = await this.createUser(
                    record.full_name,
                    record.email,
                    record.password,
                    record.mi_id
                );
                results.success.push({ email: record.email, id: user.id });
            } catch (error) {
                results.failed.push({ email: record.email, error: error.message });
            }
        }

        return results;
    }

    // Suspend user (ADMIN only)
    async suspendUser(userId) {
        const db = getPool();
        const [users] = await db.execute(
            'SELECT id FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            throw new Error('User not found');
        }

        await db.execute(
            'UPDATE users SET status = ? WHERE id = ?',
            ['SUSPENDED', userId]
        );
    }

    // Activate user (ADMIN only)
    async activateUser(userId) {
        const db = getPool();
        const [users] = await db.execute(
            'SELECT id FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            throw new Error('User not found');
        }

        await db.execute(
            'UPDATE users SET status = ? WHERE id = ?',
            ['ACTIVE', userId]
        );
    }

    // Reset password (ADMIN only)
    async resetPassword(userId, newPassword) {
        const db = getPool();
        const [users] = await db.execute(
            'SELECT id FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            throw new Error('User not found');
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        await db.execute(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [passwordHash, userId]
        );
    }
}

module.exports = new UserService();
