const express = require('express');
const leaderboardService = require('../services/leaderboard.service');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// GET /api/leaderboard - Get leaderboard stats
router.get('/', async (req, res) => {
    try {
        const stats = await leaderboardService.getOverallStats();
        const topPerformers = await leaderboardService.getTopPerformers(10);

        res.json({
            success: true,
            data: {
                stats,
                topPerformers
            }
        });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch leaderboard'
        });
    }
});

// GET /api/leaderboard/competitions-with-rounds - Get competitions that have rounds
router.get('/competitions-with-rounds', async (req, res) => {
    try {
        const competitions = await leaderboardService.getCompetitionsWithRounds();
        res.json({
            success: true,
            data: competitions
        });
    } catch (error) {
        console.error('Get competitions with rounds error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch competitions'
        });
    }
});

// GET /api/leaderboard/competition/:id - Get competition leaderboard (legacy)
router.get('/competition/:id', async (req, res) => {
    try {
        const competitionId = parseInt(req.params.id);
        const leaderboard = await leaderboardService.getCompetitionLeaderboard(competitionId);

        res.json({
            success: true,
            data: leaderboard
        });
    } catch (error) {
        console.error('Get competition leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch competition leaderboard'
        });
    }
});

// GET /api/leaderboard/competition/:id/rounds - Get all rounds for a competition
router.get('/competition/:id/rounds', async (req, res) => {
    try {
        const competitionId = parseInt(req.params.id);
        const rounds = await leaderboardService.getCompetitionRounds(competitionId);
        res.json({
            success: true,
            data: rounds
        });
    } catch (error) {
        console.error('Get competition rounds error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch rounds'
        });
    }
});

// GET /api/leaderboard/competition/:id/winners - Get finale winners
router.get('/competition/:id/winners', async (req, res) => {
    try {
        const competitionId = parseInt(req.params.id);
        const winners = await leaderboardService.getCompetitionWinners(competitionId);
        res.json({
            success: true,
            data: winners
        });
    } catch (error) {
        console.error('Get competition winners error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch winners'
        });
    }
});

// GET /api/leaderboard/round/:id - Get round leaderboard
router.get('/round/:id', async (req, res) => {
    try {
        const roundId = parseInt(req.params.id);
        const round = await leaderboardService.getRoundLeaderboard(roundId);

        if (!round) {
            return res.status(404).json({
                success: false,
                message: 'Round not found'
            });
        }

        res.json({
            success: true,
            data: round
        });
    } catch (error) {
        console.error('Get round leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch round leaderboard'
        });
    }
});

// GET /api/leaderboard/city/:id - Get city leaderboard
router.get('/city/:id', async (req, res) => {
    try {
        const cityId = parseInt(req.params.id);
        const leaderboard = await leaderboardService.getCityLeaderboard(cityId);

        res.json({
            success: true,
            data: leaderboard
        });
    } catch (error) {
        console.error('Get city leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch city leaderboard'
        });
    }
});

// GET /api/leaderboard/my-positions/:competitionId - Get user's positions in rounds (authenticated)
router.get('/my-positions/:competitionId', authenticateToken, async (req, res) => {
    try {
        const competitionId = parseInt(req.params.competitionId);
        const positions = await leaderboardService.getUserRoundPositions(req.user.id, competitionId);
        res.json({
            success: true,
            data: positions
        });
    } catch (error) {
        console.error('Get user positions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch positions'
        });
    }
});

module.exports = router;

