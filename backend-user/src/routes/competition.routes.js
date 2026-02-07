const express = require('express');
const competitionService = require('../services/competition.service');
const authMiddleware = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// GET /api/competitions - List competitions with search/filter (public)
router.get('/', async (req, res) => {
    try {
        const filters = {
            search: req.query.search,
            city_id: req.query.city_id ? parseInt(req.query.city_id) : null,
            status: req.query.status || null
        };

        const competitions = await competitionService.getOpenCompetitions(filters);

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

// GET /api/competitions/:id/details - Get detailed competition info (public)
router.get('/:id/details', async (req, res) => {
    try {
        const competition = await competitionService.getCompetitionDetails(parseInt(req.params.id));

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
        console.error('Get competition details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch competition details'
        });
    }
});

// GET /api/competitions/:id - Get competition basic info (public)
router.get('/:id', async (req, res) => {
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

// POST /api/competitions/:id/register - Register for competition (authenticated)
router.post('/:id/register', authMiddleware, validate('competitionRegister'), async (req, res) => {
    try {
        const competitionId = parseInt(req.params.id);
        const { city_id } = req.validatedBody;
        const userId = req.user.id;

        const registration = await competitionService.registerForCompetition(
            userId,
            competitionId,
            city_id
        );

        res.status(201).json({
            success: true,
            message: 'Successfully registered for competition',
            data: registration
        });
    } catch (error) {
        const errorMessages = [
            'Competition not found',
            'Registration is closed for this competition',
            'Registration is not open for this competition',
            'Invalid city for this competition',
            'Already registered for this competition in this city'
        ];

        if (errorMessages.includes(error.message)) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to register for competition'
        });
    }
});

// GET /api/cities - Get list of active cities for filter dropdown
router.get('/cities/list', async (req, res) => {
    try {
        const cities = await competitionService.getActiveCities();
        res.json({
            success: true,
            data: cities
        });
    } catch (error) {
        console.error('Get cities error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch cities'
        });
    }
});

// GET /api/registrations - Get user's registrations (authenticated)
router.get('/my/registrations', authMiddleware, async (req, res) => {
    try {
        const registrations = await competitionService.getUserRegistrations(req.user.id);

        res.json({
            success: true,
            data: registrations
        });
    } catch (error) {
        console.error('Get registrations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch registrations'
        });
    }
});

module.exports = router;
