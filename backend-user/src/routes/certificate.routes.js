const express = require('express');
const certificateService = require('../services/certificate.service');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/certificates
 * Get all released certificates for the authenticated user
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const certificates = await certificateService.getUserCertificates(req.user.id);

    res.json({
      success: true,
      data: certificates
    });
  } catch (error) {
    console.error('Error fetching user certificates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch certificates',
      error: error.message
    });
  }
});

/**
 * GET /api/certificates/stats
 * Get certificate statistics for the authenticated user
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await certificateService.getUserCertificateStats(req.user.id);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching certificate stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch certificate statistics',
      error: error.message
    });
  }
});

/**
 * GET /api/certificates/by-competition
 * Get certificates grouped by competition
 */
router.get('/by-competition', authMiddleware, async (req, res) => {
  try {
    const competitions = await certificateService.getUserCertificatesByCompetition(req.user.id);

    res.json({
      success: true,
      competitions
    });
  } catch (error) {
    console.error('Error fetching certificates by competition:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch certificates',
      error: error.message
    });
  }
});

/**
 * GET /api/certificates/by-city
 * Get certificates grouped by city
 */
router.get('/by-city', authMiddleware, async (req, res) => {
  try {
    const cities = await certificateService.getUserCertificatesByCity(req.user.id);

    res.json({
      success: true,
      cities
    });
  } catch (error) {
    console.error('Error fetching certificates by city:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch certificates',
      error: error.message
    });
  }
});

/**
 * GET /api/certificates/:id
 * Get a specific certificate by ID (only if owned by user)
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const certificate = await certificateService.getCertificateById(
      req.params.id,
      req.user.id
    );

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found or not accessible'
      });
    }

    res.json({
      success: true,
      certificate
    });
  } catch (error) {
    console.error('Error fetching certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch certificate',
      error: error.message
    });
  }
});

/**
 * GET /api/certificates/:id/download
 * Download a certificate PDF (only if owned by user and released)
 */
router.get('/:id/download', authMiddleware, async (req, res) => {
  try {
    const certificate = await certificateService.getCertificateForDownload(
      req.params.id,
      req.user.id
    );

    // Construct absolute path
    const path = require('path');
    const fs = require('fs');
    
    // file_path might be relative, so construct absolute path
    let absolutePath = certificate.file_path;
    if (!path.isAbsolute(absolutePath)) {
      absolutePath = path.join(process.cwd(), '..', 'backend-admin', absolutePath);
    }
    
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      console.error('Certificate file not found:', absolutePath);
      return res.status(404).json({
        success: false,
        message: 'Certificate file not found on server'
      });
    }

    // Send file for download
    res.download(
      absolutePath,
      `certificate_${certificate.certificate_number}.pdf`,
      (error) => {
        if (error) {
          console.error('Error downloading certificate:', error);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: 'Failed to download certificate'
            });
          }
        }
      }
    );
  } catch (error) {
    console.error('Error downloading certificate:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
