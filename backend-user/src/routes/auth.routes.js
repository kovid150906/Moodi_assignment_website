const express = require('express');
const authService = require('../services/auth.service');
const { validate } = require('../middleware/validation');

const router = express.Router();

// POST /api/auth/register - User registration
router.post('/register', validate('register'), async (req, res) => {
    try {
        const { full_name, email, password, mi_id } = req.validatedBody;

        const result = await authService.register(full_name, email, password, mi_id);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: result
        });
    } catch (error) {
        if (error.message === 'Email already registered' || error.message === 'MI ID already registered') {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
});

// POST /api/auth/login - User login
router.post('/login', validate('login'), async (req, res) => {
    try {
        const { email, password } = req.validatedBody;

        const result = await authService.login(email, password);

        res.json({
            success: true,
            message: 'Login successful',
            data: result
        });
    } catch (error) {
        if (error.message === 'Invalid email or password' || error.message === 'Account suspended') {
            return res.status(401).json({
                success: false,
                message: error.message
            });
        }
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token required'
            });
        }

        const result = await authService.refreshAccessToken(refreshToken);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Invalid refresh token'
        });
    }
});

// POST /api/auth/logout - Logout (invalidate refresh token)
router.post('/logout', async (req, res) => {
    try {
        const { userId, refreshToken } = req.body;

        if (userId && refreshToken) {
            await authService.logout(userId, refreshToken);
        }

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        res.json({
            success: true,
            message: 'Logged out'
        });
    }
});

module.exports = router;
