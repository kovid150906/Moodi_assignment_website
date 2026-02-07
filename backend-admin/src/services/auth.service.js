const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/database');

class AuthService {
    // Validate password strength
    validatePassword(password) {
        if (!password || password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }
        if (!/[A-Z]/.test(password)) {
            throw new Error('Password must contain at least one uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
            throw new Error('Password must contain at least one lowercase letter');
        }
        if (!/[0-9]/.test(password)) {
            throw new Error('Password must contain at least one number');
        }
    }

    // Generate access token for admin
    generateAccessToken(adminId) {
        return jwt.sign(
            { adminId },
            process.env.ADMIN_JWT_SECRET,
            { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
        );
    }

    // Generate refresh token for admin
    generateRefreshToken(adminId) {
        return jwt.sign(
            { adminId },
            process.env.ADMIN_JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
        );
    }

    // Save refresh token to database
    async saveRefreshToken(adminId, token) {
        const db = getPool();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await db.execute(
            'INSERT INTO admin_refresh_tokens (admin_id, token, expires_at) VALUES (?, ?, ?)',
            [adminId, token, expiresAt]
        );
    }

    // NO SELF-REGISTRATION FOR ADMINS
    // Admins can only be created by other admins

    // Login admin
    async login(email, password) {
        const db = getPool();
        const [admins] = await db.execute(
            'SELECT id, full_name, email, password_hash, role, status FROM admins WHERE email = ?',
            [email]
        );

        if (admins.length === 0) {
            throw new Error('Invalid email or password');
        }

        const admin = admins[0];

        if (admin.status !== 'ACTIVE') {
            throw new Error('Account suspended');
        }

        const validPassword = await bcrypt.compare(password, admin.password_hash);
        if (!validPassword) {
            throw new Error('Invalid email or password');
        }

        const accessToken = this.generateAccessToken(admin.id);
        const refreshToken = this.generateRefreshToken(admin.id);

        await this.saveRefreshToken(admin.id, refreshToken);

        return {
            admin: {
                id: admin.id,
                full_name: admin.full_name,
                email: admin.email,
                role: admin.role
            },
            accessToken,
            refreshToken
        };
    }

    // Refresh access token
    async refreshAccessToken(refreshToken) {
        const db = getPool();
        try {
            const decoded = jwt.verify(refreshToken, process.env.ADMIN_JWT_REFRESH_SECRET);

            const [tokens] = await db.execute(
                'SELECT * FROM admin_refresh_tokens WHERE admin_id = ? AND token = ? AND expires_at > NOW()',
                [decoded.adminId, refreshToken]
            );

            if (tokens.length === 0) {
                throw new Error('Invalid refresh token');
            }

            const accessToken = this.generateAccessToken(decoded.adminId);

            return { accessToken };
        } catch (error) {
            throw new Error('Invalid refresh token');
        }
    }

    // Create admin (ADMIN only)
    async createAdmin(fullName, email, password, role) {
        const db = getPool();
        const [existing] = await db.execute(
            'SELECT id FROM admins WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            throw new Error('Email already registered');
        }

        // Validate password strength
        this.validatePassword(password);

        const passwordHash = await bcrypt.hash(password, 10);

        const [result] = await db.execute(
            'INSERT INTO admins (full_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
            [fullName, email, passwordHash, role, 'ACTIVE']
        );

        return {
            id: result.insertId,
            full_name: fullName,
            email,
            role
        };
    }

    // Get all admins
    async getAllAdmins() {
        const db = getPool();
        const [admins] = await db.execute(
            'SELECT id, full_name, email, role, status, created_at FROM admins ORDER BY created_at DESC'
        );
        return admins;
    }

    // Suspend admin (ADMIN only, cannot suspend other ADMINs)
    async suspendAdmin(adminId, currentAdminId) {
        const db = getPool();
        const [admins] = await db.execute(
            'SELECT id, role FROM admins WHERE id = ?',
            [adminId]
        );

        if (admins.length === 0) {
            throw new Error('Admin not found');
        }

        if (admins[0].role === 'ADMIN') {
            throw new Error('Cannot suspend another ADMIN');
        }

        if (admins[0].id === currentAdminId) {
            throw new Error('Cannot suspend yourself');
        }

        await db.execute(
            'UPDATE admins SET status = ? WHERE id = ?',
            ['SUSPENDED', adminId]
        );
    }
}

module.exports = new AuthService();
