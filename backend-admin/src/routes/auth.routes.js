const express = require('express');
const bcrypt = require('bcryptjs');
const authService = require('../services/auth.service');
const auditService = require('../services/audit.service');
const { validate } = require('../middleware/validation');
const authMiddleware = require('../middleware/auth');
const { getPool } = require('../config/database');

const router = express.Router();

// POST /api/auth/login - Admin login (NO REGISTRATION)
router.post('/login', validate('login'), async (req, res) => {
    try {
        const { email, password } = req.validatedBody;

        const result = await authService.login(email, password);

        // Log the login
        await auditService.log(
            result.admin.id,
            'LOGIN',
            'admin',
            result.admin.id,
            { email: result.admin.email },
            req.ip
        );

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
        console.error('Admin login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

// POST /api/auth/refresh - Refresh token
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

// POST /api/auth/change-password - Change admin password
router.post('/change-password', authMiddleware, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        const adminId = req.admin.id;

        if (!current_password || !new_password) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        if (new_password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters'
            });
        }

        const db = getPool();
        
        // Get current admin
        const [admins] = await db.execute(
            'SELECT id, password_hash FROM admins WHERE id = ?',
            [adminId]
        );

        if (admins.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        // Verify current password
        const isValid = await bcrypt.compare(current_password, admins[0].password_hash);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password and update
        const newHash = await bcrypt.hash(new_password, 10);
        await db.execute(
            'UPDATE admins SET password_hash = ? WHERE id = ?',
            [newHash, adminId]
        );

        // Log the password change
        await auditService.log(
            adminId,
            'CHANGE_PASSWORD',
            'admin',
            adminId,
            { email: req.admin.email },
            req.ip
        );

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change password'
        });
    }
});

module.exports = router;
