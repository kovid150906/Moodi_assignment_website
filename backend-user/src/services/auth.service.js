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

    // Generate access token
    generateAccessToken(userId) {
        return jwt.sign(
            { userId },
            process.env.USER_JWT_SECRET,
            { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
        );
    }

    // Generate refresh token
    generateRefreshToken(userId) {
        return jwt.sign(
            { userId },
            process.env.USER_JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
        );
    }

    // Save refresh token to database
    async saveRefreshToken(userId, token) {
        const db = getPool();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        await db.execute(
            'INSERT INTO user_refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
            [userId, token, expiresAt]
        );
    }

    // Register new user
    async register(fullName, email, password, miId) {
        const db = getPool();
        
        // Validate MI ID is provided
        if (!miId || miId.trim() === '') {
            throw new Error('MI ID is required');
        }
        
        // Check if email already exists
        const [existingEmail] = await db.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingEmail.length > 0) {
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

        // Validate password strength
        this.validatePassword(password);

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert user
        const [result] = await db.execute(
            'INSERT INTO users (full_name, email, password_hash, mi_id, status) VALUES (?, ?, ?, ?, ?)',
            [fullName, email, passwordHash, miId, 'ACTIVE']
        );

        const userId = result.insertId;

        // Generate tokens
        const accessToken = this.generateAccessToken(userId);
        const refreshToken = this.generateRefreshToken(userId);

        // Save refresh token
        await this.saveRefreshToken(userId, refreshToken);

        return {
            user: {
                id: userId,
                full_name: fullName,
                email,
                mi_id: miId
            },
            accessToken,
            refreshToken
        };
    }

    // Login user
    async login(email, password) {
        const db = getPool();
        // Find user
        const [users] = await db.execute(
            'SELECT id, mi_id, full_name, email, password_hash, status FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            throw new Error('Invalid email or password');
        }

        const user = users[0];

        // Check if suspended
        if (user.status !== 'ACTIVE') {
            throw new Error('Account suspended');
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            throw new Error('Invalid email or password');
        }

        // Generate tokens
        const accessToken = this.generateAccessToken(user.id);
        const refreshToken = this.generateRefreshToken(user.id);

        // Save refresh token
        await this.saveRefreshToken(user.id, refreshToken);

        return {
            user: {
                id: user.id,
                mi_id: user.mi_id,
                full_name: user.full_name,
                email: user.email
            },
            accessToken,
            refreshToken
        };
    }

    // Refresh access token
    async refreshAccessToken(refreshToken) {
        const db = getPool();
        try {
            // Verify refresh token
            const decoded = jwt.verify(refreshToken, process.env.USER_JWT_REFRESH_SECRET);

            // Check if token exists in database
            const [tokens] = await db.execute(
                'SELECT * FROM user_refresh_tokens WHERE user_id = ? AND token = ? AND expires_at > NOW()',
                [decoded.userId, refreshToken]
            );

            if (tokens.length === 0) {
                throw new Error('Invalid refresh token');
            }

            // Generate new access token
            const accessToken = this.generateAccessToken(decoded.userId);

            return { accessToken };
        } catch (error) {
            throw new Error('Invalid refresh token');
        }
    }

    // Logout (invalidate refresh token)
    async logout(userId, refreshToken) {
        const db = getPool();
        await db.execute(
            'DELETE FROM user_refresh_tokens WHERE user_id = ? AND token = ?',
            [userId, refreshToken]
        );
    }
}

module.exports = new AuthService();
