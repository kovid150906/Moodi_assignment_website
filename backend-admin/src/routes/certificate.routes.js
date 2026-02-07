const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const certificateService = require("../services/certificate.service");
const auditService = require("../services/audit.service");
const authMiddleware = require("../middleware/auth");
const { adminOnly, anyAdmin } = require("../middleware/roleCheck");

const router = express.Router();

// =====================================================
// MULTER CONFIGURATION FOR FILE UPLOADS
// =====================================================

const uploadDir = path.join(__dirname, "../../uploads/templates");

// Ensure upload directory exists
fs.mkdir(uploadDir, { recursive: true }).catch(console.error);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `template_${Date.now()}_${Math.floor(
      Math.random() * 10000
    )}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, PNG, and JPG files are allowed"));
    }
  },
});

// =====================================================
// TEMPLATE MANAGEMENT ROUTES
// =====================================================

/**
 * GET /api/certificates/templates
 * Get all certificate templates
 */
router.get("/templates", authMiddleware, anyAdmin, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      competition_id: req.query.competition_id,
    };

    const templates = await certificateService.getAllTemplates(filters);

    res.json({
      success: true,
      templates,
    });
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch templates",
      error: error.message,
    });
  }
});

/**
 * GET /api/certificates/templates/:id
 * Get template by ID with all fields
 */
router.get("/templates/:id", authMiddleware, anyAdmin, async (req, res) => {
  try {
    const template = await certificateService.getTemplateById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    res.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error("Error fetching template:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch template",
      error: error.message,
    });
  }
});

/**
 * POST /api/certificates/templates
 * Create a new certificate template
 */
router.post(
  "/templates",
  authMiddleware,
  anyAdmin,
  upload.single("template_file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Template file is required",
        });
      }

      const {
        name,
        description,
        page_width,
        page_height,
        orientation,
        competition_id,
      } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Template name is required",
        });
      }

      // Determine file type
      let file_type = "PDF";
      if (req.file.mimetype.includes("png")) file_type = "PNG";
      else if (
        req.file.mimetype.includes("jpeg") ||
        req.file.mimetype.includes("jpg")
      )
        file_type = "JPG";

      // Auto-detect dimensions from PDF if it's a PDF file
      let dimensions = {
        page_width: page_width || 842,
        page_height: page_height || 595,
        orientation: orientation || "LANDSCAPE",
      };

      if (file_type === "PDF") {
        try {
          dimensions = await certificateService.extractPDFDimensions(
            req.file.path
          );
        } catch (error) {
          console.log(
            "Could not extract PDF dimensions, using defaults:",
            error.message
          );
        }
      }

      const templateData = {
        name,
        description,
        file_type,
        page_width: dimensions.page_width,
        page_height: dimensions.page_height,
        orientation: dimensions.orientation,
        competition_id: competition_id || null,
      };

      const result = await certificateService.createTemplate(
        templateData,
        req.file.path,
        req.admin.id
      );

      // Log action
      await auditService.log(
        req.admin.id,
        "CREATE_TEMPLATE",
        "certificate_template",
        result.id,
        {
          name,
          file_path: req.file.path,
        },
        req.ip
      );

      res.status(201).json({
        success: true,
        message: "Template created successfully",
        template_id: result.id,
      });
    } catch (error) {
      console.error("Error creating template:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create template",
        error: error.message,
      });
    }
  }
);

/**
 * PUT /api/certificates/templates/:id
 * Update template metadata
 */
router.put("/templates/:id", authMiddleware, anyAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      competition_id,
      page_width,
      page_height,
      orientation,
      status,
    } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (competition_id !== undefined) updates.competition_id = competition_id;
    if (page_width) updates.page_width = page_width;
    if (page_height) updates.page_height = page_height;
    if (orientation) updates.orientation = orientation;
    if (status) updates.status = status;

    await certificateService.updateTemplate(req.params.id, updates);

    // Log action
    await auditService.log(
      req.admin.id,
      "UPDATE_TEMPLATE",
      "certificate_template",
      req.params.id,
      updates,
      req.ip
    );

    res.json({
      success: true,
      message: "Template updated successfully",
    });
  } catch (error) {
    console.error("Error updating template:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update template",
      error: error.message,
    });
  }
});

/**
 * DELETE /api/certificates/templates/:id
 * Delete a template
 */
router.delete("/templates/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    await certificateService.deleteTemplate(req.params.id);

    // Log action
    await auditService.log(
      req.admin.id,
      "DELETE_TEMPLATE",
      "certificate_template",
      req.params.id,
      {},
      req.ip
    );

    res.json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete template",
      error: error.message,
    });
  }
});

/**
 * POST /api/certificates/templates/:id/archive
 * Archive a template
 */
router.post(
  "/templates/:id/archive",
  authMiddleware,
  anyAdmin,
  async (req, res) => {
    try {
      await certificateService.archiveTemplate(req.params.id);

      // Log action
      await auditService.log(
        req.admin.id,
        "ARCHIVE_TEMPLATE",
        "certificate_template",
        req.params.id,
        {},
        req.ip
      );

      res.json({
        success: true,
        message: "Template archived successfully",
      });
    } catch (error) {
      console.error("Error archiving template:", error);
      res.status(500).json({
        success: false,
        message: "Failed to archive template",
        error: error.message,
      });
    }
  }
);

// =====================================================
// TEMPLATE FIELD MANAGEMENT ROUTES
// =====================================================

/**
 * POST /api/certificates/templates/:id/fields
 * Add a field to template
 */
router.post(
  "/templates/:id/fields",
  authMiddleware,
  anyAdmin,
  async (req, res) => {
    try {
      const field = req.body;

      if (!field.field_type) {
        return res.status(400).json({
          success: false,
          message: "field_type is required",
        });
      }

      const result = await certificateService.addTemplateField(
        req.params.id,
        field
      );

      // Log action
      await auditService.log(
        req.admin.id,
        "ADD_TEMPLATE_FIELD",
        "certificate_template_field",
        result.id,
        field,
        req.ip
      );

      res.status(201).json({
        success: true,
        message: "Field added successfully",
        field_id: result.id,
      });
    } catch (error) {
      console.error("Error adding field:", error);
      res.status(500).json({
        success: false,
        message: "Failed to add field",
        error: error.message,
      });
    }
  }
);

/**
 * PUT /api/certificates/templates/fields/:fieldId
 * Update a template field
 */
router.put(
  "/templates/fields/:fieldId",
  authMiddleware,
  anyAdmin,
  async (req, res) => {
    try {
      await certificateService.updateTemplateField(
        req.params.fieldId,
        req.body
      );

      // Log action
      await auditService.log(
        req.admin.id,
        "UPDATE_TEMPLATE_FIELD",
        "certificate_template_field",
        req.params.fieldId,
        req.body,
        req.ip
      );

      res.json({
        success: true,
        message: "Field updated successfully",
      });
    } catch (error) {
      console.error("Error updating field:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update field",
        error: error.message,
      });
    }
  }
);

/**
 * DELETE /api/certificates/templates/fields/:fieldId
 * Delete a template field
 */
router.delete(
  "/templates/fields/:fieldId",
  authMiddleware,
  anyAdmin,
  async (req, res) => {
    try {
      await certificateService.deleteTemplateField(req.params.fieldId);

      // Log action
      await auditService.log(
        req.admin.id,
        "DELETE_TEMPLATE_FIELD",
        "certificate_template_field",
        req.params.fieldId,
        {},
        req.ip
      );

      res.json({
        success: true,
        message: "Field deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting field:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete field",
        error: error.message,
      });
    }
  }
);

/**
 * PUT /api/certificates/templates/:id/fields/bulk
 * Bulk update all fields for a template
 */
router.put(
  "/templates/:id/fields/bulk",
  authMiddleware,
  anyAdmin,
  async (req, res) => {
    try {
      const { fields } = req.body;

      if (!Array.isArray(fields)) {
        return res.status(400).json({
          success: false,
          message: "fields must be an array",
        });
      }

      await certificateService.updateTemplateFields(req.params.id, fields);

      // Log action
      await auditService.log(
        req.admin.id,
        "BULK_UPDATE_FIELDS",
        "certificate_template",
        req.params.id,
        { field_count: fields.length },
        req.ip
      );

      res.json({
        success: true,
        message: "Fields updated successfully",
      });
    } catch (error) {
      console.error("Error updating fields:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update fields",
        error: error.message,
      });
    }
  }
);

// =====================================================
// TEMPLATE PREVIEW & PARSING ROUTES
// =====================================================

/**
 * GET /api/certificates/templates/:id/preview-image
 * Get template preview image (converts PDF to PNG for visual editor)
 */
router.get(
  "/templates/:id/preview-image",
  authMiddleware,
  anyAdmin,
  async (req, res) => {
    try {
      const template = await certificateService.getTemplateById(req.params.id);

      if (!template) {
        return res.status(404).json({
          success: false,
          message: "Template not found",
        });
      }

      // For PDFs, convert to PNG image
      if (template.file_type === "PDF") {
        const pngBuffer = await certificateService.convertPDFToImage(
          template.file_path
        );
        const base64 = pngBuffer.toString("base64");

        res.json({
          success: true,
          data: {
            base64: base64,
            width: template.page_width,
            height: template.page_height,
            orientation: template.orientation,
          },
        });
      } else {
        // For images, return file path
        let filePath = template.file_path;
        if (filePath.includes("uploads")) {
          const uploadsIndex = filePath.lastIndexOf("uploads");
          filePath = "/" + filePath.substring(uploadsIndex).replace(/\\/g, "/");
        }

        res.json({
          success: true,
          data: {
            file_path: filePath,
            width: template.page_width,
            height: template.page_height,
            orientation: template.orientation,
          },
        });
      }
    } catch (error) {
      console.error("Error getting template preview:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get template preview",
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/certificates/templates/:id/pdf
 * Get template PDF file directly (for PDF.js viewer)
 */
router.get("/templates/:id/pdf", authMiddleware, anyAdmin, async (req, res) => {
  try {
    const template = await certificateService.getTemplateById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    if (!template.file_path) {
      return res.status(404).json({
        success: false,
        message: "Template file not available",
      });
    }

    // Set CORS headers
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    res.header("Content-Type", "application/pdf");

    res.sendFile(template.file_path);
  } catch (error) {
    console.error("Error serving template PDF:", error);
    res.status(500).json({
      success: false,
      message: "Failed to serve template PDF",
      error: error.message,
    });
  }
});

/**
 * POST /api/certificates/templates/:id/parse-svg
 * Parse SVG/PDF to detect fields
 */
router.post(
  "/templates/:id/parse-svg",
  authMiddleware,
  anyAdmin,
  async (req, res) => {
    try {
      const template = await certificateService.getTemplateById(req.params.id);

      if (!template) {
        return res.status(404).json({
          success: false,
          message: "Template not found",
        });
      }

      // Parse PDF to detect placeholders
      const detected = await certificateService.parsePDFForFields(template);

      res.json({
        success: true,
        data: detected,
      });
    } catch (error) {
      console.error("Error parsing template:", error);
      res.status(500).json({
        success: false,
        message: "Failed to parse template",
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/certificates/templates/:id/preview-placeholders
 * Generate PDF preview with placeholder markers
 */
router.post(
  "/templates/:id/preview-placeholders",
  authMiddleware,
  anyAdmin,
  async (req, res) => {
    try {
      const { fields } = req.body;

      const pdfBuffer =
        await certificateService.generatePreviewWithPlaceholders(
          req.params.id,
          fields || []
        );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="preview.pdf"'
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating preview:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate preview",
        error: error.message,
      });
    }
  }
);

// =====================================================
// CERTIFICATE GENERATION ROUTES
// =====================================================

/**
 * POST /api/certificates/generate
 * Generate certificates for specific participations (ADMIN ONLY)
 */
router.post("/generate", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { template_id, participation_ids } = req.body;

    if (
      !template_id ||
      !participation_ids ||
      !Array.isArray(participation_ids)
    ) {
      return res.status(400).json({
        success: false,
        message: "template_id and participation_ids (array) are required",
      });
    }

    const results = await certificateService.generateCertificates(
      template_id,
      participation_ids,
      req.admin.id
    );

    // Log action
    await auditService.log(
      req.admin.id,
      "GENERATE_CERTIFICATES",
      "certificate",
      null,
      {
        template_id,
        total: participation_ids.length,
        success: results.success.length,
        failed: results.failed.length,
      },
      req.ip
    );

    res.json({
      success: true,
      message: "Certificate generation completed",
      results,
    });
  } catch (error) {
    console.error("Error generating certificates:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate certificates",
      error: error.message,
    });
  }
});

/**
 * POST /api/certificates/generate/competition
 * Generate certificates for all participants in a competition/city (ADMIN ONLY)
 */
router.post(
  "/generate/competition",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const { competition_id, city_id, template_id } = req.body;

      if (!competition_id || !template_id) {
        return res.status(400).json({
          success: false,
          message: "competition_id and template_id are required",
        });
      }

      const results =
        await certificateService.generateCertificatesForCompetition(
          competition_id,
          city_id,
          template_id,
          req.admin.id
        );

      // Log action
      await auditService.log(
        req.admin.id,
        "GENERATE_COMPETITION_CERTIFICATES",
        "certificate",
        null,
        {
          competition_id,
          city_id,
          template_id,
          success: results.success.length,
          failed: results.failed.length,
        },
        req.ip
      );

      res.json({
        success: true,
        message: "Certificate generation completed",
        results,
      });
    } catch (error) {
      console.error("Error generating certificates:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate certificates",
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/certificates/generate/round
 * Generate certificates for all participants in a specific round (ADMIN ONLY)
 */
router.post(
  "/generate/round",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const { round_id, template_id } = req.body;

      if (!round_id || !template_id) {
        return res.status(400).json({
          success: false,
          message: "round_id and template_id are required",
        });
      }

      const results = await certificateService.generateCertificatesForRound(
        round_id,
        template_id,
        req.admin.id
      );

      // Log action
      await auditService.log(
        req.admin.id,
        "GENERATE_ROUND_CERTIFICATES",
        "certificate",
        null,
        {
          round_id,
          template_id,
          success: results.success.length,
          failed: results.failed.length,
        },
        req.ip
      );

      res.json({
        success: true,
        message: "Certificate generation completed",
        results,
      });
    } catch (error) {
      console.error("Error generating certificates:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate certificates",
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/certificates/generate/winners
 * Generate certificates for winners only in a specific round (ADMIN ONLY)
 */
router.post(
  "/generate/winners",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const { round_id, template_id } = req.body;

      if (!round_id || !template_id) {
        return res.status(400).json({
          success: false,
          message: "round_id and template_id are required",
        });
      }

      const results = await certificateService.generateCertificatesForWinners(
        round_id,
        template_id,
        req.admin.id
      );

      // Log action
      await auditService.log(
        req.admin.id,
        "GENERATE_WINNER_CERTIFICATES",
        "certificate",
        null,
        {
          round_id,
          template_id,
          success: results.success.length,
          failed: results.failed.length,
        },
        req.ip
      );

      res.json({
        success: true,
        message: "Winner certificate generation completed",
        results,
      });
    } catch (error) {
      console.error("Error generating winner certificates:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate winner certificates",
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/certificates/release/winners/:roundId
 * Release certificates for winners only in a round (with specific template)
 */
router.post("/release/winners/:roundId", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { template_id } = req.body;
    // template_id is optional - if not provided, releases ALL winner certificates

    const affectedRows = await certificateService.releaseCertificatesForWinners(
      req.params.roundId,
      template_id || null,
      req.admin.id
    );

    await auditService.log(
      req.admin.id,
      "RELEASE_WINNER_CERTIFICATES",
      "round",
      req.params.roundId,
      { affectedRows, template_id },
      req.ip
    );

    res.json({
      success: true,
      message: `Released ${affectedRows} winner certificates`,
      affectedRows
    });
  } catch (error) {
    console.error("Error releasing winner certificates:", error);
    res.status(500).json({
      success: false,
      message: "Failed to release winner certificates",
      error: error.message
    });
  }
});

/**
 * POST /api/certificates/withdraw/winners/:roundId
 * Withdraw (revoke) certificates for winners only in a round (with specific template)
 */
router.post("/withdraw/winners/:roundId", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { template_id, reason } = req.body;
    // template_id is optional - if not provided, withdraws ALL winner certificates

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "reason is required for withdrawal"
      });
    }

    const affectedRows = await certificateService.withdrawCertificatesForWinners(
      req.params.roundId,
      template_id || null,
      reason,
      req.admin.id
    );

    await auditService.log(
      req.admin.id,
      "WITHDRAW_WINNER_CERTIFICATES",
      "round",
      req.params.roundId,
      { affectedRows, template_id, reason },
      req.ip
    );

    res.json({
      success: true,
      message: `Withdrew ${affectedRows} winner certificates`,
      affectedRows
    });
  } catch (error) {
    console.error("Error withdrawing winner certificates:", error);
    res.status(500).json({
      success: false,
      message: "Failed to withdraw winner certificates",
      error: error.message
    });
  }
});

/**
 * GET /api/certificates/counts/competition/:competitionId
 * Get certificate counts by round and template for a competition
 */
router.get("/counts/competition/:competitionId", authMiddleware, anyAdmin, async (req, res) => {
  try {
    const counts = await certificateService.getCertificateCountsByRound(req.params.competitionId);

    res.json({
      success: true,
      data: counts
    });
  } catch (error) {
    console.error("Error getting certificate counts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get certificate counts",
      error: error.message
    });
  }
});

// =====================================================
// CERTIFICATE PREVIEW ROUTES
// =====================================================

/**
 * POST /api/certificates/preview
 * Preview certificate with sample or real data (returns base64)
 */
router.post("/preview", authMiddleware, anyAdmin, async (req, res) => {
  try {
    const { template_id, participation_id, sample_data } = req.body;

    if (!template_id) {
      return res.status(400).json({
        success: false,
        message: "template_id is required",
      });
    }

    const preview = await certificateService.previewCertificate(
      template_id,
      participation_id,
      sample_data
    );

    res.json({
      success: true,
      preview,
    });
  } catch (error) {
    console.error("Error previewing certificate:", error);
    res.status(500).json({
      success: false,
      message: "Failed to preview certificate",
      error: error.message,
    });
  }
});

/**
 * POST /api/certificates/preview-pdf
 * Preview certificate and return as PDF file
 */
router.post("/preview-pdf", authMiddleware, anyAdmin, async (req, res) => {
  try {
    const { template_id, participation_id, sample_data } = req.body;

    if (!template_id) {
      return res.status(400).json({
        success: false,
        message: "template_id is required",
      });
    }

    const preview = await certificateService.previewCertificate(
      template_id,
      participation_id,
      sample_data
    );

    const pdfBuffer = Buffer.from(preview.base64, 'base64');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="certificate_preview.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error previewing certificate PDF:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate preview PDF",
      error: error.message,
    });
  }
});

// =====================================================
// CERTIFICATE MANAGEMENT ROUTES
// =====================================================

/**
 * GET /api/certificates
 * Get all certificates with filters
 */
router.get("/", authMiddleware, anyAdmin, async (req, res) => {
  try {
    const filters = {
      competition_id: req.query.competition_id,
      city_id: req.query.city_id,
      status: req.query.status,
      user_id: req.query.user_id,
    };

    const certificates = await certificateService.getAllCertificates(filters);

    res.json({
      success: true,
      certificates,
    });
  } catch (error) {
    console.error("Error fetching certificates:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch certificates",
      error: error.message,
    });
  }
});

/**
 * GET /api/certificates/stats
 * Get certificate statistics
 */
router.get("/stats", authMiddleware, anyAdmin, async (req, res) => {
  try {
    const stats = await certificateService.getCertificateStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stats",
      error: error.message,
    });
  }
});

/**
 * GET /api/certificates/:id
 * Get certificate by ID
 */
router.get("/:id", authMiddleware, anyAdmin, async (req, res) => {
  try {
    const certificate = await certificateService.getCertificateById(
      req.params.id
    );

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found",
      });
    }

    res.json({
      success: true,
      certificate,
    });
  } catch (error) {
    console.error("Error fetching certificate:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch certificate",
      error: error.message,
    });
  }
});

/**
 * POST /api/certificates/:id/release
 * Release a certificate to user
 */
router.post("/:id/release", authMiddleware, anyAdmin, async (req, res) => {
  try {
    await certificateService.releaseCertificate(req.params.id, req.admin.id);

    // Log action
    await auditService.log(
      req.admin.id,
      "RELEASE_CERTIFICATE",
      "certificate",
      req.params.id,
      {},
      req.ip
    );

    res.json({
      success: true,
      message: "Certificate released successfully",
    });
  } catch (error) {
    console.error("Error releasing certificate:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to release certificate",
      error: error.message,
    });
  }
});

/**
 * POST /api/certificates/release/bulk
 * Bulk release certificates
 */
router.post("/release/bulk", authMiddleware, anyAdmin, async (req, res) => {
  try {
    const { certificate_ids } = req.body;

    if (!Array.isArray(certificate_ids)) {
      return res.status(400).json({
        success: false,
        message: "certificate_ids must be an array",
      });
    }

    const results = await certificateService.bulkReleaseCertificates(
      certificate_ids,
      req.admin.id
    );

    // Log action
    await auditService.log(
      req.admin.id,
      "BULK_RELEASE_CERTIFICATES",
      "certificate",
      null,
      {
        total: certificate_ids.length,
        ...results,
      },
      req.ip
    );

    res.json({
      success: true,
      message: "Bulk release completed",
      results,
    });
  } catch (error) {
    console.error("Error bulk releasing certificates:", error);
    res.status(500).json({
      success: false,
      message: "Failed to bulk release certificates",
      error: error.message,
    });
  }
});

/**
 * POST /api/certificates/:id/revoke
 * Revoke a certificate
 */
router.post("/:id/revoke", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Revocation reason is required",
      });
    }

    await certificateService.revokeCertificate(
      req.params.id,
      reason,
      req.admin.id
    );

    // Log action
    await auditService.log(
      req.admin.id,
      "REVOKE_CERTIFICATE",
      "certificate",
      req.params.id,
      { reason },
      req.ip
    );

    res.json({
      success: true,
      message: "Certificate revoked successfully",
    });
  } catch (error) {
    console.error("Error revoking certificate:", error);
    res.status(500).json({
      success: false,
      message: "Failed to revoke certificate",
      error: error.message,
    });
  }
});

/**
 * POST /api/certificates/revoke/competition/:competitionId
 * Revoke all certificates for a competition
 */
router.post("/revoke/competition/:competitionId", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Revocation reason is required",
      });
    }

    const affectedRows = await certificateService.revokeCertificatesByCompetition(
      req.params.competitionId,
      reason,
      req.admin.id
    );

    // Log action
    await auditService.log(
      req.admin.id,
      "REVOKE_CERTIFICATES_COMPETITION",
      "competition",
      req.params.competitionId,
      { reason, affectedRows },
      req.ip
    );

    res.json({
      success: true,
      message: `Revoked ${affectedRows} certificates for the competition`,
      affectedRows,
    });
  } catch (error) {
    console.error("Error revoking certificates by competition:", error);
    res.status(500).json({
      success: false,
      message: "Failed to revoke certificates",
      error: error.message,
    });
  }
});

/**
 * POST /api/certificates/release/round/:roundId
 * Release all certificates for a round
 */
router.post("/release/round/:roundId", authMiddleware, adminOnly, async (req, res) => {
  try {
    const affectedRows = await certificateService.releaseCertificatesByRound(
      req.params.roundId,
      req.admin.id
    );

    // Log action
    await auditService.log(
      req.admin.id,
      "RELEASE_CERTIFICATES_ROUND",
      "round",
      req.params.roundId,
      { affectedRows },
      req.ip
    );

    res.json({
      success: true,
      message: `Released ${affectedRows} certificates for the round`,
      affectedRows,
    });
  } catch (error) {
    console.error("Error releasing certificates by round:", error);
    res.status(500).json({
      success: false,
      message: "Failed to release certificates",
      error: error.message,
    });
  }
});

/**
 * POST /api/certificates/revoke/round/:roundId
 * Revoke all certificates for a round
 */
router.post("/revoke/round/:roundId", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Revocation reason is required",
      });
    }

    const affectedRows = await certificateService.revokeCertificatesByRound(
      req.params.roundId,
      reason,
      req.admin.id
    );

    // Log action
    await auditService.log(
      req.admin.id,
      "REVOKE_CERTIFICATES_ROUND",
      "round",
      req.params.roundId,
      { reason, affectedRows },
      req.ip
    );

    res.json({
      success: true,
      message: `Revoked ${affectedRows} certificates for the round`,
      affectedRows,
    });
  } catch (error) {
    console.error("Error revoking certificates by round:", error);
    res.status(500).json({
      success: false,
      message: "Failed to revoke certificates",
      error: error.message,
    });
  }
});

/**
 * DELETE /api/certificates/:id
 * Delete a certificate
 */
router.delete("/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    await certificateService.deleteCertificate(req.params.id);

    // Log action
    await auditService.log(
      req.admin.id,
      "DELETE_CERTIFICATE",
      "certificate",
      req.params.id,
      {},
      req.ip
    );

    res.json({
      success: true,
      message: "Certificate deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting certificate:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete certificate",
      error: error.message,
    });
  }
});

/**
 * GET /api/certificates/:id/download
 * Download certificate file
 */
router.get("/:id/download", authMiddleware, anyAdmin, async (req, res) => {
  try {
    const certificate = await certificateService.getCertificateById(
      req.params.id
    );

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found",
      });
    }

    if (!certificate.file_path) {
      return res.status(404).json({
        success: false,
        message: "Certificate file not available",
      });
    }

    res.download(
      certificate.file_path,
      `certificate_${certificate.certificate_number}.pdf`
    );
  } catch (error) {
    console.error("Error downloading certificate:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download certificate",
      error: error.message,
    });
  }
});

module.exports = router;
