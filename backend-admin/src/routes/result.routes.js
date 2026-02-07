const express = require('express');
const resultService = require('../services/result.service');
const auditService = require('../services/audit.service');
const authMiddleware = require('../middleware/auth');
const { adminOnly, anyAdmin } = require('../middleware/roleCheck');
const { validate } = require('../middleware/validation');

const router = express.Router();

// GET /api/results/competition/:id - Get results for competition (ALL admins)
router.get('/competition/:id', authMiddleware, anyAdmin, async (req, res) => {
    try {
        const results = await resultService.getResultsByCompetition(parseInt(req.params.id));

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('Get results error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch results'
        });
    }
});

// POST /api/results - Assign result (ALL admins)
router.post('/', authMiddleware, anyAdmin, validate('assignResult'), async (req, res) => {
    try {
        const { participation_id, result_status, position } = req.validatedBody;

        const result = await resultService.assignResult(participation_id, result_status, position);

        await auditService.log(
            req.admin.id,
            'ASSIGN_RESULT',
            'result',
            result.id,
            { participation_id, result_status, position },
            req.ip
        );

        res.status(201).json({
            success: true,
            message: result.created ? 'Result assigned' : 'Result updated',
            data: result
        });
    } catch (error) {
        if (error.message === 'Participation not found') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        if (error.message === 'Result is locked and cannot be modified') {
            return res.status(403).json({
                success: false,
                message: error.message
            });
        }
        console.error('Assign result error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign result'
        });
    }
});

// POST /api/results/bulk - Bulk assign results (ALL admins)
router.post('/bulk', authMiddleware, anyAdmin, async (req, res) => {
    try {
        const { results } = req.body;

        if (!Array.isArray(results) || results.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Results array required'
            });
        }

        const outcomes = await resultService.bulkAssignResults(results);

        await auditService.log(
            req.admin.id,
            'BULK_ASSIGN_RESULTS',
            'result',
            null,
            {
                success_count: outcomes.success.length,
                failed_count: outcomes.failed.length
            },
            req.ip
        );

        res.json({
            success: true,
            message: `Assigned ${outcomes.success.length} results`,
            data: outcomes
        });
    } catch (error) {
        console.error('Bulk assign error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign results'
        });
    }
});

// PATCH /api/results/:id/lock - Lock result (ALL admins)
router.patch('/:id/lock', authMiddleware, anyAdmin, async (req, res) => {
    try {
        const resultId = parseInt(req.params.id);
        await resultService.lockResult(resultId);

        await auditService.log(
            req.admin.id,
            'LOCK_RESULT',
            'result',
            resultId,
            {},
            req.ip
        );

        res.json({
            success: true,
            message: 'Result locked'
        });
    } catch (error) {
        if (error.message === 'Result not found') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        console.error('Lock result error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to lock result'
        });
    }
});

// PATCH /api/results/:id/unlock - Unlock result (ADMIN only)
router.patch('/:id/unlock', authMiddleware, adminOnly, async (req, res) => {
    try {
        const resultId = parseInt(req.params.id);
        await resultService.unlockResult(resultId);

        await auditService.log(
            req.admin.id,
            'UNLOCK_RESULT',
            'result',
            resultId,
            {},
            req.ip
        );

        res.json({
            success: true,
            message: 'Result unlocked'
        });
    } catch (error) {
        if (error.message === 'Result not found') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        console.error('Unlock result error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unlock result'
        });
    }
});

module.exports = router;
