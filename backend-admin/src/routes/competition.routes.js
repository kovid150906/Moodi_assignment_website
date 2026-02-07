const express = require('express');
const competitionService = require('../services/competition.service');
const auditService = require('../services/audit.service');
const authMiddleware = require('../middleware/auth');
const { adminOnly, anyAdmin } = require('../middleware/roleCheck');
const { validate } = require('../middleware/validation');

const router = express.Router();

// GET /api/competitions - List all competitions (ALL admins)
router.get('/', authMiddleware, anyAdmin, async (req, res) => {
    try {
        const filters = { status: req.query.status };
        const competitions = await competitionService.getAllCompetitions(filters);

        res.json({
            success: true,
            data: competitions
        });
    } catch (error) {
        console.error('Get competitions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch competitions'
        });
    }
});

// GET /api/competitions/cities - Get all cities (ALL admins)
router.get('/cities', authMiddleware, anyAdmin, async (req, res) => {
    try {
        const cities = await competitionService.getAllCities();

        res.json({
            success: true,
            data: cities
        });
    } catch (error) {
        console.error('Get cities error:', error);
        res.status(500).json({ success: false, message: 'Failed to get cities' });
    }
});

// POST /api/competitions/cities - Create new city (ADMIN only)
router.post('/cities', authMiddleware, adminOnly, validate('createCity'), async (req, res) => {
    try {
        const { name } = req.validatedBody;
        const city = await competitionService.createCity(name);

        await auditService.log(
            req.admin.id,
            'CREATE_CITY',
            'city',
            city.id,
            { name },
            req.ip
        );

        res.status(201).json({
            success: true,
            message: 'City created successfully',
            data: city
        });
    } catch (error) {
        if (error.message === 'City already exists') {
            return res.status(409).json({ success: false, message: error.message });
        }
        console.error('Create city error:', error);
        res.status(500).json({ success: false, message: 'Failed to create city' });
    }
});

// GET /api/competitions/:id - Get competition details (ALL admins)
router.get('/:id', authMiddleware, anyAdmin, async (req, res) => {
    try {
        const competition = await competitionService.getCompetitionById(parseInt(req.params.id));

        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Competition not found'
            });
        }

        res.json({
            success: true,
            data: competition
        });
    } catch (error) {
        console.error('Get competition error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch competition'
        });
    }
});

// GET /api/competitions/:id/dashboard - Get full competition dashboard (ALL admins)
router.get('/:id/dashboard', authMiddleware, anyAdmin, async (req, res) => {
    try {
        const dashboard = await competitionService.getCompetitionDashboard(parseInt(req.params.id));

        res.json({
            success: true,
            data: dashboard
        });
    } catch (error) {
        console.error('Get competition dashboard error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch competition dashboard'
        });
    }
});

// GET /api/competitions/:id/participants - Get participants (ALL admins)
router.get('/:id/participants', authMiddleware, anyAdmin, async (req, res) => {
    try {
        const participants = await competitionService.getParticipants(parseInt(req.params.id));

        res.json({
            success: true,
            data: participants
        });
    } catch (error) {
        console.error('Get participants error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch participants'
        });
    }
});

// POST /api/competitions - Create competition (ALL admins)
router.post('/', authMiddleware, anyAdmin, validate('createCompetition'), async (req, res) => {
    try {
        const competition = await competitionService.createCompetition(req.validatedBody);

        await auditService.log(
            req.admin.id,
            'CREATE_COMPETITION',
            'competition',
            competition.id,
            { name: competition.name },
            req.ip
        );

        res.status(201).json({
            success: true,
            message: 'Competition created successfully',
            data: competition
        });
    } catch (error) {
        console.error('Create competition error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create competition'
        });
    }
});

// PATCH /api/competitions/:id - Update competition (ALL admins)
router.patch('/:id', authMiddleware, anyAdmin, validate('updateCompetition'), async (req, res) => {
    try {
        const competitionId = parseInt(req.params.id);
        await competitionService.updateCompetition(competitionId, req.validatedBody);

        await auditService.log(
            req.admin.id,
            'UPDATE_COMPETITION',
            'competition',
            competitionId,
            req.validatedBody,
            req.ip
        );

        res.json({
            success: true,
            message: 'Competition updated'
        });
    } catch (error) {
        console.error('Update competition error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update competition'
        });
    }
});

// PATCH /api/competitions/:id/status - Update competition status (ALL admins)
router.patch('/:id/status', authMiddleware, anyAdmin, async (req, res) => {
    try {
        const competitionId = parseInt(req.params.id);
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        const result = await competitionService.updateStatus(competitionId, status);

        await auditService.log(
            req.admin.id,
            'UPDATE_COMPETITION_STATUS',
            'competition',
            competitionId,
            { status },
            req.ip
        );

        res.json({
            success: true,
            message: `Competition status updated to ${status}`,
            data: result
        });
    } catch (error) {
        if (error.message.includes('Cannot transition')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Update status error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update status'
        });
    }
});

// PATCH /api/competitions/:id/registration - Toggle registration open/closed (ALL admins)
router.patch('/:id/registration', authMiddleware, anyAdmin, async (req, res) => {
    try {
        const competitionId = parseInt(req.params.id);
        const { registration_open } = req.body;

        if (registration_open === undefined) {
            return res.status(400).json({
                success: false,
                message: 'registration_open is required'
            });
        }

        const result = await competitionService.toggleRegistration(competitionId, registration_open);

        await auditService.log(
            req.admin.id,
            'TOGGLE_REGISTRATION',
            'competition',
            competitionId,
            { registration_open },
            req.ip
        );

        res.json({
            success: true,
            message: `Registration ${registration_open ? 'opened' : 'closed'}`,
            data: result
        });
    } catch (error) {
        console.error('Toggle registration error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to toggle registration'
        });
    }
});

// DELETE /api/competitions/:id - Delete competition (ADMIN only)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const competitionId = parseInt(req.params.id);
        await competitionService.deleteCompetition(competitionId);

        await auditService.log(
            req.admin.id,
            'DELETE_COMPETITION',
            'competition',
            competitionId,
            {},
            req.ip
        );

        res.json({
            success: true,
            message: 'Competition deleted'
        });
    } catch (error) {
        if (error.message === 'Competition not found') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        if (error.message === 'Cannot delete competition with existing participants') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Delete competition error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete competition'
        });
    }
});

// POST /api/competitions/:id/cities - Add city to competition (Add Branch)
router.post('/:id/cities', authMiddleware, anyAdmin, validate('addCityToCompetition'), async (req, res) => {
    try {
        const { city_id, event_date } = req.validatedBody;
        const competitionId = parseInt(req.params.id);

        await competitionService.addCity(competitionId, city_id, event_date);

        await auditService.log(
            req.admin.id,
            'ADD_COMPETITION_CITY',
            'competition',
            competitionId,
            { city_id, event_date },
            req.ip
        );

        res.status(201).json({
            success: true,
            message: 'City added to competition successfully'
        });
    } catch (error) {
        if (error.message === 'City not found' || error.message === 'City already added to this competition') {
            return res.status(400).json({ success: false, message: error.message });
        }
        console.error('Add city error:', error);
        res.status(500).json({ success: false, message: 'Failed to add city' });
    }
});

// DELETE /api/competitions/:id/cities/:cityId - Remove city from competition
router.delete('/:id/cities/:cityId', authMiddleware, adminOnly, async (req, res) => {
    try {
        const competitionId = parseInt(req.params.id);
        const cityId = parseInt(req.params.cityId);

        await competitionService.removeCity(competitionId, cityId);

        await auditService.log(
            req.admin.id,
            'REMOVE_COMPETITION_CITY',
            'competition',
            competitionId,
            { city_id: cityId },
            req.ip
        );

        res.json({
            success: true,
            message: 'City removed from competition successfully'
        });
    } catch (error) {
        if (error.message.includes('not associated') || error.message.includes('Cannot remove')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        console.error('Remove city error:', error);
        res.status(500).json({ success: false, message: 'Failed to remove city' });
    }
});

// PATCH /api/competitions/:id/cities/:cityId - Update city event date
router.patch('/:id/cities/:cityId', authMiddleware, anyAdmin, async (req, res) => {
    try {
        const competitionId = parseInt(req.params.id);
        const cityId = parseInt(req.params.cityId);
        const { event_date } = req.body;

        await competitionService.updateCityEventDate(competitionId, cityId, event_date);

        await auditService.log(
            req.admin.id,
            'UPDATE_CITY_EVENT_DATE',
            'competition',
            competitionId,
            { city_id: cityId, event_date },
            req.ip
        );

        res.json({
            success: true,
            message: 'City event date updated successfully'
        });
    } catch (error) {
        if (error.message.includes('not associated')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        console.error('Update city event date error:', error);
        res.status(500).json({ success: false, message: 'Failed to update event date' });
    }
});

// POST /api/competitions/:id/participants - Add participant (ALL admins)
router.post('/:id/participants', authMiddleware, anyAdmin, validate('addParticipant'), async (req, res) => {
    try {
        const { user_id, city_id } = req.validatedBody;
        const competitionId = parseInt(req.params.id);

        const participation = await competitionService.addParticipant(user_id, competitionId, city_id);

        await auditService.log(
            req.admin.id,
            'ADD_PARTICIPANT',
            'participation',
            participation.id,
            { user_id, competition_id: competitionId, city_id },
            req.ip
        );

        res.status(201).json({
            success: true,
            message: 'Participant added',
            data: participation
        });
    } catch (error) {
        const knownErrors = [
            'User not found',
            'Competition not found',
            'Invalid city for this competition',
            'User already registered for this competition'
        ];

        if (knownErrors.includes(error.message)) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Add participant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add participant'
        });
    }
});

module.exports = router;
