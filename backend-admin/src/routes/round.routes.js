const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parse/sync');
const roundService = require('../services/round.service');
const auditService = require('../services/audit.service');
const authMiddleware = require('../middleware/auth');
const { anyAdmin, adminOnly } = require('../middleware/roleCheck');

// Configure multer for CSV uploads
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'), false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Create a new round
router.post('/', authMiddleware, async (req, res) => {
    try {
        const round = await roundService.createRound(req.body);
        await auditService.log(
            req.admin.id,
            'CREATE_ROUND',
            'round',
            round.id,
            { round_name: req.body.round_name, competition_id: req.body.competition_id },
            req.ip
        );
        res.status(201).json({
            success: true,
            message: 'Round created successfully',
            data: round
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Get all rounds for a competition
router.get('/competition/:competitionId', authMiddleware, async (req, res) => {
    try {
        const rounds = await roundService.getRoundsByCompetition(req.params.competitionId);
        res.json({
            success: true,
            data: rounds
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get round details with participants and scores
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const round = await roundService.getRoundDetails(req.params.id);
        res.json({
            success: true,
            data: round
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            message: error.message
        });
    }
});

// Update round details
router.patch('/:id', authMiddleware, async (req, res) => {
    try {
        const round = await roundService.updateRound(req.params.id, req.body);
        await auditService.log(
            req.admin.id,
            'UPDATE_ROUND',
            'round',
            req.params.id,
            { updates: req.body },
            req.ip
        );
        res.json({
            success: true,
            message: 'Round updated successfully',
            data: round
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Upload scores from CSV
router.post('/:id/upload-scores', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'CSV file is required'
            });
        }

        // Check file size (5MB limit)
        if (req.file.size > 5 * 1024 * 1024) {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum 5MB allowed'
            });
        }

        // Parse CSV
        const csvContent = req.file.buffer.toString('utf-8');
        const records = csv.parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        if (records.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'CSV file is empty'
            });
        }

        // Check row count limit (5000 max)
        if (records.length > 5000) {
            return res.status(400).json({
                success: false,
                message: 'Maximum 5000 rows allowed per upload'
            });
        }

        // Validate required columns - support both email and mi_id
        const firstRow = records[0];
        const hasEmail = firstRow.email !== undefined;
        const hasMiId = firstRow.mi_id !== undefined;
        
        if ((!hasEmail && !hasMiId) || firstRow.score === undefined) {
            return res.status(400).json({
                success: false,
                message: 'CSV must have "email" or "mi_id" column, and "score" column'
            });
        }

        const result = await roundService.uploadScores(req.params.id, records, req.admin.id);
        await auditService.log(
            req.admin.id,
            'UPLOAD_SCORES',
            'round',
            req.params.id,
            { success: result.success, skipped: result.skipped, failed: result.failed, records_count: records.length },
            req.ip
        );
        res.json({
            success: true,
            message: `Processed ${result.success} scores, ${result.skipped} skipped (already exist), ${result.failed} failed`,
            data: result
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Clear all scores for a round
router.delete('/:id/scores', authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await roundService.clearScores(req.params.id, req.admin.id);
        await auditService.log(
            req.admin.id,
            'CLEAR_SCORES',
            'round',
            req.params.id,
            { deleted_count: result.deletedCount },
            req.ip
        );
        res.json({
            success: true,
            message: `Cleared ${result.deletedCount} scores`,
            data: result
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Promote top X to next round
router.post('/:id/promote', authMiddleware, anyAdmin, async (req, res) => {
    try {
        const { count } = req.body;
        if (!count || count < 1) {
            return res.status(400).json({
                success: false,
                message: 'Count must be at least 1'
            });
        }

        const result = await roundService.promoteToNextRound(req.params.id, count, req.admin.id);
        await auditService.log(
            req.admin.id,
            'PROMOTE_ROUND',
            'round',
            req.params.id,
            { promoted_count: result.promoted, count: count },
            req.ip
        );
        res.json({
            success: true,
            message: `Promoted ${result.promoted} participants to next round`,
            data: result
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Manually add participant to round
router.post('/:id/add-participant', authMiddleware, async (req, res) => {
    try {
        const { participation_id } = req.body;
        if (!participation_id) {
            return res.status(400).json({
                success: false,
                message: 'participation_id is required'
            });
        }

        await roundService.addParticipantToRound(req.params.id, participation_id, req.admin.id);

        res.json({
            success: true,
            message: 'Participant added to round'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Remove participant from round
router.delete('/:id/participants/:participationId', authMiddleware, async (req, res) => {
    try {
        await roundService.removeParticipantFromRound(req.params.id, req.params.participationId);

        res.json({
            success: true,
            message: 'Participant removed from round'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Get eligible participants for manual addition
router.get('/:id/eligible-participants', authMiddleware, async (req, res) => {
    try {
        const participants = await roundService.getEligibleParticipants(req.params.id);
        res.json({
            success: true,
            data: participants
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update individual score
router.patch('/scores/:roundParticipationId', authMiddleware, async (req, res) => {
    try {
        const { score, notes } = req.body;
        if (score === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Score is required'
            });
        }

        await roundService.updateScore(req.params.roundParticipationId, score, notes, req.admin.id);

        res.json({
            success: true,
            message: 'Score updated'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Select winners for finale
router.post('/:id/select-winners', authMiddleware, async (req, res) => {
    try {
        const { winners } = req.body;
        if (!winners || !Array.isArray(winners) || winners.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Winners array is required'
            });
        }

        const result = await roundService.selectWinners(req.params.id, winners, req.admin.id);
        await auditService.log(
            req.admin.id,
            'SELECT_WINNERS',
            'round',
            req.params.id,
            { winners_count: result.winners_count },
            req.ip
        );
        res.json({
            success: true,
            message: `Selected ${result.winners_count} winners`,
            data: result
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Get round leaderboard
router.get('/:id/leaderboard', authMiddleware, async (req, res) => {
    try {
        const leaderboard = await roundService.getRoundLeaderboard(req.params.id);
        res.json({
            success: true,
            data: leaderboard
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get available winners for import (by city)
router.get('/:id/available-winners', authMiddleware, async (req, res) => {
    try {
        const cities = await roundService.getAvailableWinnersForImport(req.params.id);
        res.json({
            success: true,
            cities: cities
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Import selected winners from cities
router.post('/:id/import-selected-winners', authMiddleware, async (req, res) => {
    try {
        console.log('Import selected winners request:', req.body);
        const { citySelections } = req.body;
        if (!citySelections || !Array.isArray(citySelections)) {
            console.log('Invalid citySelections:', citySelections);
            return res.status(400).json({
                success: false,
                message: 'citySelections array is required'
            });
        }
        console.log('Importing with selections:', citySelections);
        const result = await roundService.importSelectedWinners(req.params.id, citySelections, req.admin.id);
        console.log('Import result:', result);
        await auditService.log(
            req.admin.id,
            'IMPORT_WINNERS',
            'round',
            req.params.id,
            { imported_count: result.imported_count, city_selections: citySelections.length },
            req.ip
        );
        res.json({
            success: true,
            message: `Imported ${result.imported_count} winners successfully`,
            data: result
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Import city winners (all - legacy)
router.post('/:id/import-winners', authMiddleware, async (req, res) => {
    try {
        const result = await roundService.importCityWinners(req.params.id, req.admin.id);
        res.json({
            success: true,
            message: `Imported ${result.imported_count} winners successfully`,
            data: result
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Mark competition-city as finished
router.post('/competition/:competitionId/city/:cityId/finish', authMiddleware, async (req, res) => {
    try {
        const result = await roundService.markCompetitionCityFinished(
            parseInt(req.params.competitionId),
            parseInt(req.params.cityId),
            req.admin.id
        );
        res.json({
            success: true,
            message: result.competition_completed 
                ? 'Competition marked as completed! All cities finished.'
                : `City finished! ${result.winners_added} winners added to results.`,
            data: result
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Reopen competition-city (undo finished state)
router.post('/competition/:competitionId/city/:cityId/reopen', authMiddleware, async (req, res) => {
    try {
        const result = await roundService.reopenCompetitionCity(
            parseInt(req.params.competitionId),
            parseInt(req.params.cityId),
            req.admin.id
        );
        res.json({
            success: true,
            message: result.message,
            data: result
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Get competition-city status
router.get('/competition/:competitionId/city/:cityId/status', authMiddleware, async (req, res) => {
    try {
        const status = await roundService.getCompetitionCityStatus(
            parseInt(req.params.competitionId),
            parseInt(req.params.cityId)
        );
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Delete a round (removes all data)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await roundService.deleteRound(parseInt(req.params.id));
        await auditService.log(
            req.admin.id,
            'DELETE_ROUND',
            'round',
            req.params.id,
            { deleted_results: result },
            req.ip
        );
        res.json({
            success: true,
            message: 'Round deleted successfully',
            data: result
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Archive a round (keeps data but hides it)
router.patch('/:id/archive', authMiddleware, async (req, res) => {
    try {
        const result = await roundService.archiveRound(parseInt(req.params.id));
        await auditService.log(
            req.admin.id,
            'ARCHIVE_ROUND',
            'round',
            req.params.id,
            { archived: true },
            req.ip
        );
        res.json({
            success: true,
            message: 'Round archived successfully',
            data: result
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Unarchive a round
router.patch('/:id/unarchive', authMiddleware, async (req, res) => {
    try {
        const result = await roundService.unarchiveRound(parseInt(req.params.id));
        await auditService.log(
            req.admin.id,
            'UNARCHIVE_ROUND',
            'round',
            req.params.id,
            { archived: false },
            req.ip
        );
        res.json({
            success: true,
            message: 'Round unarchived successfully',
            data: result
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
