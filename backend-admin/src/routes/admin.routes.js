const express = require('express');
const authService = require('../services/auth.service');
const auditService = require('../services/audit.service');
const authMiddleware = require('../middleware/auth');
const { adminOnly } = require('../middleware/roleCheck');
const { validate } = require('../middleware/validation');

const router = express.Router();

// GET /api/admins - List all admins (ADMIN only)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
    try {
        const admins = await authService.getAllAdmins();

        res.json({
            success: true,
            data: admins
        });
    } catch (error) {
        console.error('Get admins error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch admins'
        });
    }
});

// POST /api/admins - Create admin/coordinator (ADMIN only)
router.post('/', authMiddleware, adminOnly, validate('createAdmin'), async (req, res) => {
    try {
        const { full_name, email, password, role } = req.validatedBody;

        const admin = await authService.createAdmin(full_name, email, password, role);

        await auditService.log(
            req.admin.id,
            'CREATE_ADMIN',
            'admin',
            admin.id,
            { email, role },
            req.ip
        );

        res.status(201).json({
            success: true,
            message: `${role} created successfully`,
            data: admin
        });
    } catch (error) {
        if (error.message === 'Email already registered') {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }
        console.error('Create admin error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create admin'
        });
    }
});

// PATCH /api/admins/:id/suspend - Suspend coordinator (ADMIN only)
router.patch('/:id/suspend', authMiddleware, adminOnly, async (req, res) => {
    try {
        const adminId = parseInt(req.params.id);
        await authService.suspendAdmin(adminId, req.admin.id);

        await auditService.log(
            req.admin.id,
            'SUSPEND_ADMIN',
            'admin',
            adminId,
            {},
            req.ip
        );

        res.json({
            success: true,
            message: 'Admin suspended'
        });
    } catch (error) {
        const knownErrors = ['Admin not found', 'Cannot suspend another ADMIN', 'Cannot suspend yourself'];
        if (knownErrors.includes(error.message)) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Suspend admin error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to suspend admin'
        });
    }
});

// GET /api/admins/audit-logs - View audit logs (ADMIN only)
router.get('/audit-logs', authMiddleware, adminOnly, async (req, res) => {
    try {
        const filters = {
            admin_id: req.query.admin_id,
            action: req.query.action,
            entity_type: req.query.entity_type,
            from_date: req.query.from_date,
            to_date: req.query.to_date
        };

        const logs = await auditService.getLogs(filters);

        res.json({
            success: true,
            data: logs
        });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch audit logs'
        });
    }
});

module.exports = router;
