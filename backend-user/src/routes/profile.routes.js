const express = require('express');
const router = express.Router();
const profileService = require('../services/profile.service');
const authMiddleware = require('../middleware/auth');

// Get user profile
router.get('/', authMiddleware, async (req, res) => {
    try {
        const profile = await profileService.getProfile(req.user.id);
        res.json({
            success: true,
            data: profile
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get profile'
        });
    }
});

// Update profile
router.put('/', authMiddleware, async (req, res) => {
    try {
        const { full_name } = req.body;

        if (!full_name || full_name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Full name must be at least 2 characters'
            });
        }

        const profile = await profileService.updateProfile(req.user.id, { full_name });
        res.json({
            success: true,
            message: 'Profile updated',
            data: profile
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update profile'
        });
    }
});

// Get user stats
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const stats = await profileService.getStats(req.user.id);
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get stats'
        });
    }
});

// Change password
router.post('/change-password', authMiddleware, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password required'
            });
        }

        if (new_password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters'
            });
        }

        await profileService.changePassword(req.user.id, current_password, new_password);
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        if (error.message === 'Current password is incorrect') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        res.status(500).json({
            success: false,
            message: 'Failed to change password'
        });
    }
});

// Get participation history (detailed)
router.get('/history', authMiddleware, async (req, res) => {
    try {
        const history = await profileService.getParticipationHistory(req.user.id);
        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get participation history'
        });
    }
});

module.exports = router;

