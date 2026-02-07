const { getPool } = require("../config/database");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const fs = require("fs").promises;
const path = require("path");

class CertificateService {
  constructor() {
    this.uploadDir =
      process.env.UPLOAD_DIR || path.join(__dirname, "../../uploads/templates");
    this.generatedDir =
      process.env.GENERATED_DIR ||
      path.join(__dirname, "../../generated/certificates");
  }

  // =====================================================
  // DIRECTORY MANAGEMENT
  // =====================================================
  async ensureDirectories() {
    await fs.mkdir(this.uploadDir, { recursive: true });
    await fs.mkdir(this.generatedDir, { recursive: true });
  }

  // =====================================================
  // TEMPLATE MANAGEMENT
  // =====================================================

  /**
   * Get all certificate templates with metadata
   */
  async getAllTemplates(filters = {}) {
    const db = getPool();
    let query = `
      SELECT 
        t.id,
        t.name,
        t.description,
        t.file_path,
        t.file_type,
        t.page_width,
        t.page_height,
        t.orientation,
        t.competition_id,
        t.status,
        t.created_at,
        t.updated_at,
        c.name as competition_name,
        a.full_name as created_by,
        (SELECT COUNT(*) FROM certificate_template_fields WHERE template_id = t.id) as field_count,
        (SELECT COUNT(*) FROM certificates WHERE template_id = t.id) as usage_count
      FROM certificate_templates t
      LEFT JOIN competitions c ON t.competition_id = c.id
      LEFT JOIN admins a ON t.created_by_admin_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      query += " AND t.status = ?";
      params.push(filters.status);
    }

    if (filters.competition_id) {
      query += " AND t.competition_id = ?";
      params.push(filters.competition_id);
    }

    query += " ORDER BY t.created_at DESC";

    const [templates] = await db.execute(query, params);
    return templates;
  }

  /**
   * Get template by ID with all fields
   */
  async getTemplateById(id) {
    const db = getPool();
    const [templates] = await db.execute(
      `SELECT 
        t.*,
        c.name as competition_name,
        a.full_name as created_by
      FROM certificate_templates t
      LEFT JOIN competitions c ON t.competition_id = c.id
      LEFT JOIN admins a ON t.created_by_admin_id = a.id
      WHERE t.id = ?`,
      [id]
    );

    if (templates.length === 0) {
      return null;
    }

    const template = templates[0];

    // Get all fields for this template
    const [fields] = await db.execute(
      "SELECT * FROM certificate_template_fields WHERE template_id = ? ORDER BY id",
      [id]
    );

    // Calculate text width for each field using Arial font
    try {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);
      let arialFont;
      try {
        const arialFontPath = path.join(__dirname, '../fonts/arial.ttf');
        const arialBytes = await fs.readFile(arialFontPath);
        arialFont = await pdfDoc.embedFont(arialBytes);
      } catch (fontError) {
        console.warn('Failed to load Arial font, using Helvetica:', fontError.message);
        arialFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }
      
      for (const field of fields) {
        const sampleText = field.field_type || 'Text';
        field.sample_text_width = arialFont.widthOfTextAtSize(sampleText, field.font_size);
      }
    } catch (error) {
      console.error('Error calculating text widths:', error);
    }

    template.fields = fields;
    return template;
  }

  /**
   * Extract PDF dimensions from a PDF file
   */
  async extractPDFDimensions(pdfPath) {
    try {
      const pdfBuffer = await fs.readFile(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const firstPage = pdfDoc.getPages()[0];
      const { width, height } = firstPage.getSize();

      // Determine orientation
      const orientation = width > height ? "LANDSCAPE" : "PORTRAIT";

      return {
        page_width: Math.round(width),
        page_height: Math.round(height),
        orientation,
      };
    } catch (error) {
      console.error("Error extracting PDF dimensions:", error);
      // Return defaults if extraction fails
      return {
        page_width: 842,
        page_height: 595,
        orientation: "LANDSCAPE",
      };
    }
  }

  /**
   * Create a new certificate template
   */
  async createTemplate(data, filePath, adminId) {
    const db = getPool();
    await this.ensureDirectories();

    const [result] = await db.execute(
      `INSERT INTO certificate_templates 
       (name, description, file_path, file_type, page_width, page_height, orientation, competition_id, created_by_admin_id, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.description || null,
        filePath,
        data.file_type || "PDF",
        data.page_width || 842,
        data.page_height || 595,
        data.orientation || "LANDSCAPE",
        data.competition_id || null,
        adminId,
        "ACTIVE",
      ]
    );

    return { id: result.insertId };
  }

  /**
   * Update template metadata
   */
  async updateTemplate(id, updates) {
    const db = getPool();
    const fields = [];
    const params = [];

    const allowedFields = [
      "name",
      "description",
      "competition_id",
      "page_width",
      "page_height",
      "orientation",
      "status",
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(updates[field]);
      }
    }

    if (fields.length === 0) return;

    params.push(id);
    await db.execute(
      `UPDATE certificate_templates SET ${fields.join(", ")} WHERE id = ?`,
      params
    );
  }

  /**
   * Delete a template (only if not used)
   */
  async deleteTemplate(id) {
    const db = getPool();

    // Check if template is being used
    const [certs] = await db.execute(
      "SELECT COUNT(*) as count FROM certificates WHERE template_id = ?",
      [id]
    );

    if (certs[0].count > 0) {
      throw new Error(
        "Cannot delete template that is already used in certificates"
      );
    }

    // Get file path to delete file
    const template = await this.getTemplateById(id);
    if (template && template.file_path) {
      try {
        await fs.unlink(template.file_path);
      } catch (error) {
        console.error("Error deleting template file:", error);
      }
    }

    // Delete template (fields will be cascade deleted)
    await db.execute("DELETE FROM certificate_templates WHERE id = ?", [id]);
  }

  /**
   * Archive template (soft delete)
   */
  async archiveTemplate(id) {
    const db = getPool();
    await db.execute(
      "UPDATE certificate_templates SET status = ? WHERE id = ?",
      ["ARCHIVED", id]
    );
  }

  // =====================================================
  // TEMPLATE FIELD MANAGEMENT
  // =====================================================

  /**
   * Add a field to a template
   */
  async addTemplateField(templateId, field) {
    const db = getPool();
    const [result] = await db.execute(
      `INSERT INTO certificate_template_fields 
       (template_id, field_type, field_label, x_position, y_position, width, height, font_size, font_family, font_weight, font_color, text_align, line_height, text_transform, date_format) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        templateId,
        field.field_type,
        field.field_label || null,
        field.x_position || 0,
        field.y_position || 0,
        field.width || 400,
        field.height || 50,
        field.font_size || 24,
        field.font_family || "Helvetica",
        field.font_weight || "NORMAL",
        field.font_color || "#000000",
        field.text_align || "CENTER",
        field.line_height || 1.2,
        field.text_transform || "NONE",
        field.date_format || "DD MMM YYYY",
      ]
    );

    return { id: result.insertId };
  }

  /**
   * Update a template field
   */
  async updateTemplateField(fieldId, field) {
    const db = getPool();
    const fields = [];
    const params = [];

    const allowedFields = [
      "field_type",
      "field_label",
      "x_position",
      "y_position",
      "width",
      "height",
      "font_size",
      "font_family",
      "font_weight",
      "font_color",
      "text_align",
      "line_height",
      "text_transform",
      "date_format",
    ];

    for (const key of allowedFields) {
      if (field[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(field[key]);
      }
    }

    if (fields.length === 0) return;

    params.push(fieldId);
    await db.execute(
      `UPDATE certificate_template_fields SET ${fields.join(
        ", "
      )} WHERE id = ?`,
      params
    );
  }

  /**
   * Delete a template field
   */
  async deleteTemplateField(fieldId) {
    const db = getPool();
    await db.execute("DELETE FROM certificate_template_fields WHERE id = ?", [
      fieldId,
    ]);
  }

  /**
   * Bulk update template fields (replace all fields)
   */
  async updateTemplateFields(templateId, fields) {
    const db = getPool();

    // Delete existing fields
    await db.execute(
      "DELETE FROM certificate_template_fields WHERE template_id = ?",
      [templateId]
    );

    // Add new fields
    for (const field of fields) {
      await this.addTemplateField(templateId, field);
    }
  }

  // =====================================================
  // CERTIFICATE GENERATION
  // =====================================================

  /**
   * Generate certificates for multiple participations
   */
  async generateCertificates(templateId, participationIds, adminId) {
    const db = getPool();
    await this.ensureDirectories();

    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    if (template.status !== "ACTIVE") {
      throw new Error("Template is not active");
    }

    const results = {
      success: [],
      failed: [],
    };

    for (const participationId of participationIds) {
      try {
        // Get participation data with all necessary details
        const [participations] = await db.execute(
          `
          SELECT 
            p.id,
            p.user_id,
            p.competition_id,
            p.city_id,
            u.full_name,
            u.mi_id,
            u.email,
            c.name as competition_name,
            ci.name as city_name,
            cc.event_date,
            r.result_status,
            r.position
          FROM participations p
          JOIN users u ON p.user_id = u.id
          JOIN competitions c ON p.competition_id = c.id
          JOIN cities ci ON p.city_id = ci.id
          LEFT JOIN competition_cities cc ON cc.competition_id = c.id AND cc.city_id = ci.id
          LEFT JOIN results r ON r.participation_id = p.id
          WHERE p.id = ?
        `,
          [participationId]
        );

        if (participations.length === 0) {
          throw new Error("Participation not found");
        }

        const participation = participations[0];

        // Generate certificate number
        const certNumber = await this.generateCertificateNumber(participation);

        // Generate PDF
        const pdfPath = await this.generatePDF(
          template,
          participation,
          certNumber
        );

        // Check if certificate already exists
        const [existing] = await db.execute(
          "SELECT id FROM certificates WHERE participation_id = ? AND template_id = ?",
          [participationId, templateId]
        );

        let certificateId;

        if (existing.length > 0) {
          // Update existing certificate
          certificateId = existing[0].id;
          await db.execute(
            `UPDATE certificates 
             SET file_path = ?, certificate_number = ?, status = 'GENERATED', generated_at = NOW(), generated_by_admin_id = ? 
             WHERE id = ?`,
            [pdfPath, certNumber, adminId, certificateId]
          );
          results.success.push({
            participation_id: participationId,
            certificate_id: certificateId,
            updated: true,
            user: participation.full_name,
          });
        } else {
          // Create new certificate
          const [insertResult] = await db.execute(
            `INSERT INTO certificates 
             (user_id, participation_id, template_id, certificate_number, file_path, status, generated_at, generated_by_admin_id) 
             VALUES (?, ?, ?, ?, ?, 'GENERATED', NOW(), ?)`,
            [
              participation.user_id,
              participationId,
              templateId,
              certNumber,
              pdfPath,
              adminId,
            ]
          );
          certificateId = insertResult.insertId;
          results.success.push({
            participation_id: participationId,
            certificate_id: certificateId,
            created: true,
            user: participation.full_name,
          });
        }
      } catch (error) {
        console.error(
          `Error generating certificate for participation ${participationId}:`,
          error
        );
        results.failed.push({
          participation_id: participationId,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Generate unique certificate number
   */
  async generateCertificateNumber(participation) {
    const year = new Date().getFullYear();
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");

    // Format: CERT-YEAR-COMPETITIONID-CITYID-TIMESTAMP-RANDOM
    return `CERT-${year}-${participation.competition_id}-${participation.city_id}-${timestamp}-${random}`;
  }

  /**
   * Generate PDF certificate
   */
  async generatePDF(template, data, certNumber) {
    let pdfDoc;

    try {
      // Load PDF template
      const templateBytes = await fs.readFile(template.file_path);
      pdfDoc = await PDFDocument.load(templateBytes);
      pdfDoc.registerFontkit(fontkit);
    } catch (error) {
      throw new Error(`Failed to load template: ${error.message}`);
    }

    const pages = pdfDoc.getPages();
    const page = pages[0];

    // Load Arial font with fallback to Helvetica
    let arialFont;
    try {
      const arialFontPath = path.join(__dirname, '../fonts/arial.ttf');
      const arialBytes = await fs.readFile(arialFontPath);
      arialFont = await pdfDoc.embedFont(arialBytes);
      console.log('Successfully loaded Arial font');
    } catch (fontError) {
      console.warn('Failed to load Arial font, falling back to Helvetica:', fontError.message);
      arialFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    // Apply each field to the PDF
    for (const field of template.fields) {
      let text = this.getFieldValue(field.field_type, data, field);

      if (!text) continue;

      // Apply text transformations
      text = this.applyTextTransform(text, field.text_transform);

      // Use Arial font for all text
      const font = arialFont;

      // Parse color
      const color = this.parseColor(field.font_color);

      // Calculate text metrics
      // x_position is ALWAYS the LEFT starting point of text
      // Text will always appear AT or AFTER this position
      const xPos = field.x_position;

      // Convert y from top-left origin to bottom-left origin (PDF standard)
      // y_position is where the marker is shown (roughly the vertical center of text)
      // For baseline positioning, adjust by a fraction of font size
      const yPos =
        template.page_height - field.y_position - field.font_size * 0.35;

      // Draw text on PDF
      page.drawText(text, {
        x: xPos,
        y: yPos,
        size: field.font_size,
        font: font,
        color: rgb(color.r, color.g, color.b),
        maxWidth: field.width,
        lineHeight: field.line_height * field.font_size,
      });
    }

    // Save PDF
    const filename = `cert_${certNumber}_${Date.now()}.pdf`;
    const outputPath = path.join(this.generatedDir, filename);

    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPath, pdfBytes);

    return outputPath;
  }

  /**
   * Get field value based on field type
   */
  getFieldValue(fieldType, data, field) {
    switch (fieldType) {
      case "NAME":
        return data.full_name;
      case "COMPETITION":
        return data.competition_name;
      case "CITY":
        return data.city_name;
      case "DATE":
        return data.event_date
          ? this.formatDate(data.event_date, field.date_format)
          : "";
      case "RESULT":
        return data.result_status || "PARTICIPATED";
      case "POSITION":
        return data.position
          ? `${this.getOrdinal(data.position)} Position`
          : "";
      case "MI_ID":
        return data.mi_id || "";
      case "CUSTOM":
        return field.field_label || "";
      default:
        return "";
    }
  }

  /**
   * Format date according to specified format
   */
  formatDate(date, format) {
    const d = new Date(date);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthsFull = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const day = d.getDate();
    const month = d.getMonth();
    const year = d.getFullYear();

    switch (format) {
      case "DD MMM YYYY":
        return `${day} ${months[month]} ${year}`;
      case "DD MMMM YYYY":
        return `${day} ${monthsFull[month]} ${year}`;
      case "DD/MM/YYYY":
        return `${day.toString().padStart(2, "0")}/${(month + 1)
          .toString()
          .padStart(2, "0")}/${year}`;
      case "MM/DD/YYYY":
        return `${(month + 1).toString().padStart(2, "0")}/${day
          .toString()
          .padStart(2, "0")}/${year}`;
      case "YYYY-MM-DD":
        return `${year}-${(month + 1).toString().padStart(2, "0")}-${day
          .toString()
          .padStart(2, "0")}`;
      default:
        return `${day} ${months[month]} ${year}`;
    }
  }

  /**
   * Get ordinal suffix for position (1st, 2nd, 3rd, etc.)
   */
  getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /**
   * Apply text transformation
   */
  applyTextTransform(text, transform) {
    switch (transform) {
      case "UPPERCASE":
        return text.toUpperCase();
      case "LOWERCASE":
        return text.toLowerCase();
      case "CAPITALIZE":
        return text
          .split(" ")
          .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(" ");
      default:
        return text;
    }
  }

  /**
   * Parse hex color to RGB
   */
  parseColor(hexColor) {
    const hex = hexColor.replace("#", "");
    return {
      r: parseInt(hex.substring(0, 2), 16) / 255,
      g: parseInt(hex.substring(2, 4), 16) / 255,
      b: parseInt(hex.substring(4, 6), 16) / 255,
    };
  }

  // =====================================================
  // CERTIFICATE PREVIEW
  // =====================================================

  /**
   * Preview certificate with sample or real data
   */
  async previewCertificate(
    templateId,
    participationId = null,
    sampleData = null
  ) {
    const db = getPool();

    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    let data;

    if (participationId) {
      // Use real participation data
      const [participations] = await db.execute(
        `
        SELECT 
          p.id,
          p.user_id,
          p.competition_id,
          p.city_id,
          u.full_name,
          u.mi_id,
          c.name as competition_name,
          ci.name as city_name,
          cc.event_date,
          r.result_status,
          r.position
        FROM participations p
        JOIN users u ON p.user_id = u.id
        JOIN competitions c ON p.competition_id = c.id
        JOIN cities ci ON p.city_id = ci.id
        LEFT JOIN competition_cities cc ON cc.competition_id = c.id AND cc.city_id = ci.id
        LEFT JOIN results r ON r.participation_id = p.id
        WHERE p.id = ?
      `,
        [participationId]
      );

      if (participations.length === 0) {
        throw new Error("Participation not found");
      }

      data = participations[0];
    } else if (sampleData) {
      // Use provided sample data
      data = sampleData;
    } else {
      // Use default sample data
      data = {
        full_name: "John Doe",
        competition_name: "Sample Competition",
        city_name: "Mumbai",
        event_date: new Date(),
        result_status: "WINNER",
        position: 1,
        mi_id: "MI12345",
      };
    }

    // Generate PDF in memory
    let pdfDoc;

    try {
      const templateBytes = await fs.readFile(template.file_path);
      pdfDoc = await PDFDocument.load(templateBytes);
      pdfDoc.registerFontkit(fontkit);
    } catch (error) {
      throw new Error(`Failed to load template: ${error.message}`);
    }

    const pages = pdfDoc.getPages();
    const page = pages[0];

    // Load Arial font with fallback to Helvetica
    let arialFont;
    try {
      const arialFontPath = path.join(__dirname, '../fonts/arial.ttf');
      const arialBytes = await fs.readFile(arialFontPath);
      arialFont = await pdfDoc.embedFont(arialBytes);
      console.log('Successfully loaded Arial font');
    } catch (fontError) {
      console.warn('Failed to load Arial font, falling back to Helvetica:', fontError.message);
      arialFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    // Apply fields
    console.log('Template dimensions:', template.page_width, 'x', template.page_height);
    console.log('Number of fields:', template.fields.length);
    
    for (const field of template.fields) {
      let text = this.getFieldValue(field.field_type, data, field);

      if (!text) continue;

      text = this.applyTextTransform(text, field.text_transform);

      // Use Arial font for all text
      const font = arialFont;
      const color = this.parseColor(field.font_color);

      // x_position is ALWAYS the LEFT starting point of text
      // Text will always appear AT or AFTER this position
      const xPos = field.x_position;

      // Convert y from top-left origin to bottom-left origin (PDF standard)
      // y_position represents the VERTICAL CENTER of the text
      const yPos = template.page_height - field.y_position - field.font_size * 0.35;

      console.log(`Field ${field.field_type}: text='${text}', align=${field.text_align}`);
      console.log(`  Input pos: (${field.x_position}, ${field.y_position}), Output PDF pos: (${xPos.toFixed(1)}, ${yPos.toFixed(1)}), fontSize=${field.font_size}`);

      page.drawText(text, {
        x: xPos,
        y: yPos,
        size: field.font_size,
        font: font,
        color: rgb(color.r, color.g, color.b),
        maxWidth: field.width,
        lineHeight: field.line_height * field.font_size,
      });
    }

    const pdfBytes = await pdfDoc.save();

    return {
      base64: Buffer.from(pdfBytes).toString("base64"),
      participant: data.full_name,
      competition: data.competition_name,
      city: data.city_name,
    };
  }

  // =====================================================
  // CERTIFICATE MANAGEMENT
  // =====================================================

  /**
   * Get all certificates with filters
   */
  async getAllCertificates(filters = {}) {
    const db = getPool();
    let query = `
      SELECT 
        cert.id,
        cert.certificate_number,
        cert.file_path,
        cert.status,
        cert.generated_at,
        cert.released_at,
        cert.created_at,
        cert.template_id,
        cert.participation_id,
        cert.user_id,
        u.full_name as user_name,
        u.email,
        u.mi_id,
        p.competition_id,
        p.city_id,
        c.name as competition_name,
        ci.name as city_name,
        t.name as template_name,
        r.result_status,
        r.position,
        ga.full_name as generated_by,
        ra.full_name as released_by
      FROM certificates cert
      JOIN users u ON cert.user_id = u.id
      JOIN participations p ON cert.participation_id = p.id
      JOIN competitions c ON p.competition_id = c.id
      JOIN cities ci ON p.city_id = ci.id
      JOIN certificate_templates t ON cert.template_id = t.id
      LEFT JOIN results r ON r.participation_id = p.id
      LEFT JOIN admins ga ON cert.generated_by_admin_id = ga.id
      LEFT JOIN admins ra ON cert.released_by_admin_id = ra.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.competition_id) {
      query += " AND p.competition_id = ?";
      params.push(filters.competition_id);
    }

    if (filters.city_id) {
      query += " AND p.city_id = ?";
      params.push(filters.city_id);
    }

    if (filters.status) {
      query += " AND cert.status = ?";
      params.push(filters.status);
    }

    if (filters.user_id) {
      query += " AND cert.user_id = ?";
      params.push(filters.user_id);
    }

    query += " ORDER BY ci.name ASC, r.position ASC, cert.created_at DESC";

    const [certificates] = await db.execute(query, params);
    return certificates;
  }

  /**
   * Get certificate by ID
   */
  async getCertificateById(id) {
    const db = getPool();
    const [certificates] = await db.execute(
      `
      SELECT 
        cert.*,
        u.full_name,
        u.email,
        c.name as competition_name,
        ci.name as city_name,
        t.name as template_name
      FROM certificates cert
      JOIN users u ON cert.user_id = u.id
      JOIN participations p ON cert.participation_id = p.id
      JOIN competitions c ON p.competition_id = c.id
      JOIN cities ci ON p.city_id = ci.id
      JOIN certificate_templates t ON cert.template_id = t.id
      WHERE cert.id = ?
    `,
      [id]
    );

    return certificates.length > 0 ? certificates[0] : null;
  }

  /**
   * Release certificate (make available to user)
   */
  async releaseCertificate(certificateId, adminId) {
    const db = getPool();
    const cert = await this.getCertificateById(certificateId);

    if (!cert) {
      throw new Error("Certificate not found");
    }

    if (cert.status !== "GENERATED" && cert.status !== "REVOKED") {
      throw new Error("Certificate must be in GENERATED or REVOKED status to be released");
    }

    await db.execute(
      `UPDATE certificates 
       SET status = 'RELEASED', released_at = NOW(), released_by_admin_id = ?, revoked_at = NULL, revoke_reason = NULL 
       WHERE id = ?`,
      [adminId, certificateId]
    );
  }

  /**
   * Bulk release certificates
   */
  async bulkReleaseCertificates(certificateIds, adminId) {
    const db = getPool();
    if (certificateIds.length === 0) return { success: 0, failed: 0 };

    let success = 0;
    let failed = 0;

    for (const certId of certificateIds) {
      try {
        await this.releaseCertificate(certId, adminId);
        success++;
      } catch (error) {
        console.error(`Failed to release certificate ${certId}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Revoke certificate
   */
  async revokeCertificate(certificateId, reason, adminId) {
    const db = getPool();
    await db.execute(
      `UPDATE certificates 
       SET status = 'REVOKED', revoked_at = NOW(), revoke_reason = ? 
       WHERE id = ?`,
      [reason, certificateId]
    );
  }

  /**
   * Release all certificates for a round
   */
  async releaseCertificatesByRound(roundId, adminId) {
    const db = getPool();
    
    // Get all participation IDs in the round
    const [roundParticipations] = await db.execute(
      `SELECT participation_id FROM round_participations WHERE round_id = ?`,
      [roundId]
    );
    
    if (roundParticipations.length === 0) {
      return 0;
    }
    
    const participationIds = roundParticipations.map(rp => rp.participation_id);
    const placeholders = participationIds.map(() => '?').join(',');
    
    const [result] = await db.execute(
      `UPDATE certificates 
       SET status = 'RELEASED', released_at = NOW(), released_by_admin_id = ?, revoked_at = NULL, revoke_reason = NULL
       WHERE participation_id IN (${placeholders}) AND status IN ('GENERATED', 'REVOKED')`,
      [adminId, ...participationIds]
    );
    return result.affectedRows;
  }

  /**
   * Revoke all certificates for a competition
   */
  async revokeCertificatesByCompetition(competitionId, reason, adminId) {
    const db = getPool();
    const [result] = await db.execute(
      `UPDATE certificates c
       INNER JOIN participations p ON c.participation_id = p.id
       SET c.status = 'REVOKED', c.revoked_at = NOW(), c.revoke_reason = ? 
       WHERE p.competition_id = ? AND c.status != 'REVOKED'`,
      [reason, competitionId]
    );
    return result.affectedRows;
  }

  /**
   * Revoke all certificates for a round
   */
  async revokeCertificatesByRound(roundId, reason, adminId) {
    const db = getPool();
    
    // Get all participation IDs in the round
    const [roundParticipations] = await db.execute(
      `SELECT participation_id FROM round_participations WHERE round_id = ?`,
      [roundId]
    );
    
    if (roundParticipations.length === 0) {
      return 0;
    }
    
    const participationIds = roundParticipations.map(rp => rp.participation_id);
    const placeholders = participationIds.map(() => '?').join(',');
    
    const [result] = await db.execute(
      `UPDATE certificates 
       SET status = 'REVOKED', revoked_at = NOW(), revoke_reason = ? 
       WHERE participation_id IN (${placeholders}) AND status != 'REVOKED'`,
      [reason, ...participationIds]
    );
    return result.affectedRows;
  }

  /**
   * Delete certificate
   */
  async deleteCertificate(id) {
    const db = getPool();
    const cert = await this.getCertificateById(id);

    if (!cert) {
      throw new Error("Certificate not found");
    }

    // Delete file if exists
    if (cert.file_path) {
      try {
        await fs.unlink(cert.file_path);
      } catch (error) {
        console.error("Error deleting certificate file:", error);
      }
    }

    await db.execute("DELETE FROM certificates WHERE id = ?", [id]);
  }

  // =====================================================
  // BULK OPERATIONS
  // =====================================================

  /**
   * Generate certificates for all participants in a competition/city
   */
  async generateCertificatesForCompetition(
    competitionId,
    cityId,
    templateId,
    adminId
  ) {
    const db = getPool();

    // Get all participations for the competition and city
    let query = "SELECT id FROM participations WHERE competition_id = ?";
    const params = [competitionId];

    if (cityId) {
      query += " AND city_id = ?";
      params.push(cityId);
    }

    const [participations] = await db.execute(query, params);
    const participationIds = participations.map((p) => p.id);

    return await this.generateCertificates(
      templateId,
      participationIds,
      adminId
    );
  }

  /**
   * Generate certificates for all participants in a specific round
   */
  async generateCertificatesForRound(roundId, templateId, adminId) {
    const db = getPool();

    // Get all participations in the round
    const [roundParticipations] = await db.execute(
      `SELECT participation_id FROM round_participations WHERE round_id = ?`,
      [roundId]
    );

    const participationIds = roundParticipations.map((rp) => rp.participation_id);

    if (participationIds.length === 0) {
      return {
        success: [],
        failed: [],
        message: "No participants in this round",
      };
    }

    return await this.generateCertificates(
      templateId,
      participationIds,
      adminId
    );
  }

  /**
   * Generate certificates for winners only (participants with is_winner = TRUE in final round)
   */
  async generateCertificatesForWinners(roundId, templateId, adminId) {
    const db = getPool();

    // Get ALL winners from round_scores (everyone you selected as winner, not just position 1)
    const [winnerParticipations] = await db.execute(
      `SELECT DISTINCT rp.participation_id 
       FROM round_participations rp
       JOIN round_scores rs ON rs.round_participation_id = rp.id
       WHERE rp.round_id = ? AND rs.is_winner = TRUE`,
      [roundId]
    );

    const participationIds = winnerParticipations.map((wp) => wp.participation_id);

    if (participationIds.length === 0) {
      return {
        success: [],
        failed: [],
        message: "No winners found in this round",
      };
    }

    return await this.generateCertificates(
      templateId,
      participationIds,
      adminId
    );
  }

  /**
   * Release certificates for winners only in a round
   * @param {number} roundId - The round ID
   * @param {number|null} templateId - Optional template ID. If null, releases ALL winner certificates
   * @param {number} adminId - Admin performing the action
   */
  async releaseCertificatesForWinners(roundId, templateId, adminId) {
    const db = getPool();
    
    console.log('releaseCertificatesForWinners called with roundId:', roundId, 'templateId:', templateId);

    // Get ALL winners from round_scores (everyone you selected as winner, not just position 1)
    const [winnerParticipations] = await db.execute(
      `SELECT DISTINCT rp.participation_id 
       FROM round_participations rp
       JOIN round_scores rs ON rs.round_participation_id = rp.id
       WHERE rp.round_id = ? AND rs.is_winner = TRUE`,
      [roundId]
    );

    console.log('Found winner participations:', winnerParticipations);

    if (winnerParticipations.length === 0) {
      console.log('No winners found for round', roundId);
      return 0;
    }

    const participationIds = winnerParticipations.map((wp) => wp.participation_id);
    console.log('Participation IDs to release:', participationIds);
    
    const placeholders = participationIds.map(() => '?').join(',');
    
    // Build query based on whether templateId is provided
    let query, params;
    if (templateId) {
      query = `UPDATE certificates 
               SET status = 'RELEASED', released_at = NOW(), released_by_admin_id = ?
               WHERE template_id = ? AND participation_id IN (${placeholders}) AND status = 'GENERATED'`;
      params = [adminId, templateId, ...participationIds];
    } else {
      // No template filter - release ALL winner certificates
      query = `UPDATE certificates 
               SET status = 'RELEASED', released_at = NOW(), released_by_admin_id = ?
               WHERE participation_id IN (${placeholders}) AND status = 'GENERATED'`;
      params = [adminId, ...participationIds];
    }
    
    console.log('Query params:', params);

    const [result] = await db.execute(query, params);

    console.log('Update result:', result.affectedRows, 'rows affected');
    return result.affectedRows;
  }

  /**
   * Get certificate counts by round and template
   * Used to determine if certificates have been generated (show Regenerate vs Generate)
   */
  async getCertificateCountsByRound(competitionId) {
    const db = getPool();

    const [counts] = await db.execute(`
      SELECT 
        rp.round_id,
        c.template_id,
        COUNT(*) as total_count,
        SUM(CASE WHEN c.status = 'GENERATED' THEN 1 ELSE 0 END) as generated_count,
        SUM(CASE WHEN c.status = 'RELEASED' THEN 1 ELSE 0 END) as released_count,
        SUM(CASE WHEN c.status = 'REVOKED' THEN 1 ELSE 0 END) as revoked_count
      FROM certificates c
      JOIN round_participations rp ON rp.participation_id = c.participation_id
      JOIN rounds r ON r.id = rp.round_id
      WHERE r.competition_id = ?
      GROUP BY rp.round_id, c.template_id
    `, [competitionId]);

    return counts;
  }

  /**
   * Withdraw (revoke) certificates for winners only
   * @param {number} roundId - The round ID
   * @param {number|null} templateId - Optional template ID. If null, withdraws ALL winner certificates
   * @param {string} reason - Reason for withdrawal
   * @param {number} adminId - Admin performing the action (unused for now)
   */
  async withdrawCertificatesForWinners(roundId, templateId, reason, adminId) {
    const db = getPool();

    console.log('withdrawCertificatesForWinners called with roundId:', roundId, 'templateId:', templateId);

    // Get participation_ids for winners in this round
    const [winnerParticipations] = await db.execute(
      `SELECT DISTINCT rp.participation_id
       FROM round_participations rp
       JOIN round_scores rs ON rs.round_participation_id = rp.id
       WHERE rp.round_id = ? AND rs.is_winner = TRUE`,
      [roundId]
    );

    console.log('Found winner participations:', winnerParticipations);

    if (winnerParticipations.length === 0) {
      return 0;
    }

    const participationIds = winnerParticipations.map(w => w.participation_id);
    const placeholders = participationIds.map(() => '?').join(',');
    
    // Build query based on whether templateId is provided
    let query, params;
    if (templateId) {
      query = `UPDATE certificates 
               SET status = 'REVOKED', revoke_reason = ?, revoked_at = NOW()
               WHERE status IN ('GENERATED', 'RELEASED') 
               AND template_id = ?
               AND participation_id IN (${placeholders})`;
      params = [reason, templateId, ...participationIds];
    } else {
      // No template filter - withdraw ALL winner certificates
      query = `UPDATE certificates 
               SET status = 'REVOKED', revoke_reason = ?, revoked_at = NOW()
               WHERE status IN ('GENERATED', 'RELEASED') 
               AND participation_id IN (${placeholders})`;
      params = [reason, ...participationIds];
    }

    const [result] = await db.execute(query, params);

    console.log('Withdraw result:', result.affectedRows, 'rows affected');
    return result.affectedRows;
  }

  /**
   * Get certificate statistics
   */
  async getCertificateStats() {
    const db = getPool();

    const [stats] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'GENERATED' THEN 1 ELSE 0 END) as generated,
        SUM(CASE WHEN status = 'RELEASED' THEN 1 ELSE 0 END) as released,
        SUM(CASE WHEN status = 'REVOKED' THEN 1 ELSE 0 END) as revoked
      FROM certificates
    `);

    return stats[0];
  }

  // =====================================================
  // TEMPLATE PARSING & PREVIEW
  // =====================================================

  /**
   * Convert PDF first page to PNG image for visual editor
   */
  async convertPDFToImage(pdfPath) {
    try {
      const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
      const { createCanvas } = require("canvas");

      // Read PDF file
      const pdfBuffer = await fs.readFile(pdfPath);
      const uint8Array = new Uint8Array(pdfBuffer);

      // Load PDF
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdfDocument = await loadingTask.promise;

      // Get first page
      const page = await pdfDocument.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better quality

      // Create canvas
      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");

      // Render PDF page to canvas
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      return canvas.toBuffer("image/png");
    } catch (error) {
      console.error("Error converting PDF to image with pdf.js:", error);

      // Fallback: use simple canvas with dimensions from pdf-lib
      try {
        const { createCanvas } = require("canvas");
        const pdfBuffer = await fs.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const firstPage = pdfDoc.getPages()[0];
        const { width, height } = firstPage.getSize();

        const canvas = createCanvas(width * 2, height * 2); // 2x for better quality
        const ctx = canvas.getContext("2d");

        // Fill white background
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, width * 2, height * 2);

        // Draw border
        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, width * 2, height * 2);

        // Add text
        ctx.fillStyle = "#999";
        ctx.font = "bold 48px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("📄 PDF Template", width, height - 60);
        ctx.font = "32px Arial";
        ctx.fillText("Click anywhere to add fields", width, height + 20);
        ctx.font = "24px Arial";
        ctx.fillStyle = "#666";
        ctx.fillText(
          `Size: ${Math.round(width)} × ${Math.round(height)} pt`,
          width,
          height + 80
        );

        return canvas.toBuffer("image/png");
      } catch (fallbackError) {
        console.error("Fallback conversion also failed:", fallbackError);
        throw new Error("Failed to convert PDF to image");
      }
    }
  }

  /**
   * Parse PDF template to detect field placeholders
   */
  async parsePDFForFields(template) {
    try {
      const pdfBuffer = await fs.readFile(template.file_path);
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const firstPage = pdfDoc.getPages()[0];
      const { width, height } = firstPage.getSize();

      // Default field suggestions if no placeholders found
      const defaultFields = [
        {
          field_type: "NAME",
          x_coordinate: Math.round(width / 2),
          y_coordinate: Math.round(height * 0.45),
          font_size: 32,
          font_family: "Helvetica",
          font_color: "#000000",
          alignment: "center",
        },
        {
          field_type: "COMPETITION",
          x_coordinate: Math.round(width / 2),
          y_coordinate: Math.round(height * 0.35),
          font_size: 24,
          font_family: "Helvetica",
          font_color: "#000000",
          alignment: "center",
        },
        {
          field_type: "DATE",
          x_coordinate: Math.round(width * 0.7),
          y_coordinate: Math.round(height * 0.15),
          font_size: 18,
          font_family: "Helvetica",
          font_color: "#000000",
          alignment: "right",
        },
      ];

      return {
        dimensions: { width, height },
        fields: defaultFields,
        auto_detected: false,
      };
    } catch (error) {
      console.error("Error parsing PDF:", error);
      throw new Error("Failed to parse PDF template");
    }
  }

  /**
   * Generate preview PDF with sample text rendered exactly as it will appear in final certificate
   * Uses the SAME rendering logic as generateCertificatePDF and previewCertificate
   */
  async generatePreviewWithPlaceholders(templateId, fields) {
    try {
      const template = await this.getTemplateById(templateId);
      if (!template) {
        throw new Error("Template not found");
      }

      const pdfBuffer = await fs.readFile(template.file_path);
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      pdfDoc.registerFontkit(fontkit);
      const page = pdfDoc.getPages()[0];

      // Load Arial font with fallback to Helvetica (same as certificate generation)
      let arialFont;
      try {
        const arialFontPath = path.join(__dirname, '../fonts/arial.ttf');
        const arialBytes = await fs.readFile(arialFontPath);
        arialFont = await pdfDoc.embedFont(arialBytes);
      } catch (fontError) {
        console.warn('Preview: Failed to load Arial font, falling back to Helvetica:', fontError.message);
        arialFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }

      // Use the template's page dimensions
      const pageHeight = template.page_height || 595;

      // Render each field using EXACT same logic as certificate generation
      for (const field of fields) {
        const sampleText = this.getSampleTextForField(field.field_type);
        const fontSize = field.font_size || 20;
        const font = arialFont;
        
        // Parse color (same as certificate generation)
        const color = this.parseColor(field.font_color || '#000000');

        // x_position is ALWAYS the LEFT starting point of text
        // Text will always appear AT or AFTER this position
        const xPos = field.x_position;

        // EXACT same Y calculation as certificate generation
        const yPos = pageHeight - field.y_position - fontSize * 0.35;

        // Draw text with same parameters
        page.drawText(sampleText, {
          x: xPos,
          y: yPos,
          size: fontSize,
          font: font,
          color: rgb(color.r, color.g, color.b),
        });

        // Draw a subtle indicator showing the alignment point
        const indicatorColor = rgb(0.9, 0.2, 0.2);
        page.drawCircle({
          x: field.x_position,
          y: pageHeight - field.y_position,
          size: 4,
          color: indicatorColor,
          opacity: 0.7,
        });
      }

      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);
    } catch (error) {
      console.error("Error generating preview:", error);
      throw new Error("Failed to generate preview");
    }
  }

  /**
   * Get sample text for field type
   */
  getSampleTextForField(fieldType) {
    const samples = {
      NAME: "John Doe",
      COMPETITION: "National Math Competition",
      CITY: "New York",
      DATE: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      RESULT: "Winner",
      POSITION: "1st Place",
      MI_ID: "MI12345",
      BENEFACTORS: "Sample Benefactors",
    };
    return samples[fieldType] || `[${fieldType}]`;
  }
}

module.exports = new CertificateService();
