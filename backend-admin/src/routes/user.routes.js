const express = require('express');
const multer = require('multer');
const userService = require('../services/user.service');
const auditService = require('../services/audit.service');
const authMiddleware = require('../middleware/auth');
const { adminOnly, anyAdmin } = require('../middleware/roleCheck');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Configure multer for CSV upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files allowed'));
        }
    }
});

// GET /api/users - List all users (ALL admins)
router.get('/', authMiddleware, anyAdmin, async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            search: req.query.search
        };

        const users = await userService.getAllUsers(filters);

        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});

// GET /api/users/:id - Get user details (ALL admins)
router.get('/:id', authMiddleware, anyAdmin, async (req, res) => {
    try {
        const user = await userService.getUserById(parseInt(req.params.id));

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user'
        });
    }
});

// POST /api/users - Create user (ADMIN only)
router.post('/', authMiddleware, adminOnly, validate('createUser'), async (req, res) => {
    try {
        const { full_name, email, password, mi_id } = req.validatedBody;

        const user = await userService.createUser(full_name, email, password, mi_id);

        await auditService.log(
            req.admin.id,
            'CREATE_USER',
            'user',
            user.id,
            { email },
            req.ip
        );

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: user
        });
    } catch (error) {
        if (error.message === 'Email already registered') {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create user'
        });
    }
});

// POST /api/users/bulk - Bulk create users from CSV (ADMIN only)
router.post('/bulk', authMiddleware, adminOnly, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'CSV file required'
            });
        }

        const csvContent = req.file.buffer.toString('utf-8');
        const results = await userService.bulkCreateUsers(csvContent);

        await auditService.log(
            req.admin.id,
            'BULK_CREATE_USERS',
            'user',
            null,
            {
                success_count: results.success.length,
                failed_count: results.failed.length
            },
            req.ip
        );

        res.json({
            success: true,
            message: `Created ${results.success.length} users, ${results.failed.length} failed`,
            data: results
        });
    } catch (error) {
        console.error('Bulk create error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process CSV'
        });
    }
});

// PATCH /api/users/:id/suspend - Suspend user (ADMIN only)
router.patch('/:id/suspend', authMiddleware, adminOnly, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        await userService.suspendUser(userId);

        await auditService.log(
            req.admin.id,
            'SUSPEND_USER',
            'user',
            userId,
            {},
            req.ip
        );

        res.json({
            success: true,
            message: 'User suspended'
        });
    } catch (error) {
        if (error.message === 'User not found') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        console.error('Suspend user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to suspend user'
        });
    }
});

// PATCH /api/users/:id/activate - Activate user (ADMIN only)
router.patch('/:id/activate', authMiddleware, adminOnly, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        await userService.activateUser(userId);

        await auditService.log(
            req.admin.id,
            'ACTIVATE_USER',
            'user',
            userId,
            {},
            req.ip
        );

        res.json({
            success: true,
            message: 'User activated'
        });
    } catch (error) {
        if (error.message === 'User not found') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        console.error('Activate user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to activate user'
        });
    }
});

// POST /api/users/:id/reset-password - Reset password (ADMIN only)
router.post('/:id/reset-password', authMiddleware, adminOnly, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { new_password } = req.body;

        if (!new_password || new_password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters'
            });
        }

        await userService.resetPassword(userId, new_password);

        await auditService.log(
            req.admin.id,
            'RESET_PASSWORD',
            'user',
            userId,
            {},
            req.ip
        );

        res.json({
            success: true,
            message: 'Password reset successful'
        });
    } catch (error) {
        if (error.message === 'User not found') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password'
        });
    }
});

module.exports = router;
