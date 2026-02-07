-- =====================================================
-- Certificate System Migration Script
-- Run this to migrate from old schema to new schema
-- =====================================================

USE certificate_system;

-- Backup existing data first
CREATE TABLE IF NOT EXISTS certificates_backup AS SELECT * FROM certificates;
CREATE TABLE IF NOT EXISTS certificate_templates_backup AS SELECT * FROM certificate_templates;
CREATE TABLE IF NOT EXISTS certificate_template_fields_backup AS SELECT * FROM certificate_template_fields;

-- Drop old tables
DROP TABLE IF EXISTS certificates;
DROP TABLE IF EXISTS certificate_template_fields;
DROP TABLE IF EXISTS certificate_templates;

-- =====================================================
-- CERTIFICATE TEMPLATES (New Enhanced Version)
-- =====================================================
CREATE TABLE certificate_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    file_path VARCHAR(500) NOT NULL,
    file_type ENUM('PDF', 'PNG', 'JPG', 'SVG') DEFAULT 'PDF',
    page_width INT DEFAULT 842,  -- A4 landscape in points (1px = 0.75pt, so 842pt = 1123px)
    page_height INT DEFAULT 595,  -- A4 landscape in points (595pt = 794px)
    orientation ENUM('LANDSCAPE', 'PORTRAIT') DEFAULT 'LANDSCAPE',
    competition_id INT DEFAULT NULL,  -- Link to specific competition or NULL for generic
    status ENUM('ACTIVE', 'ARCHIVED') DEFAULT 'ACTIVE',
    created_by_admin_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL,
    INDEX idx_ct_competition (competition_id),
    INDEX idx_ct_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- CERTIFICATE TEMPLATE FIELDS (Enhanced Dynamic Text Positioning)
-- =====================================================
CREATE TABLE certificate_template_fields (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_id INT NOT NULL,
    field_type ENUM('NAME', 'COMPETITION', 'CITY', 'DATE', 'RESULT', 'POSITION', 'MI_ID', 'CUSTOM') NOT NULL,
    field_label VARCHAR(100),  -- For custom fields
    x_position INT NOT NULL DEFAULT 0,  -- X coordinate in pixels
    y_position INT NOT NULL DEFAULT 0,  -- Y coordinate in pixels
    width INT DEFAULT 400,  -- Width in pixels
    height INT DEFAULT 50,  -- Height in pixels
    font_size INT DEFAULT 24,  -- Font size in points
    font_family VARCHAR(100) DEFAULT 'Helvetica',
    font_weight ENUM('NORMAL', 'BOLD', 'LIGHT') DEFAULT 'NORMAL',
    font_color VARCHAR(20) DEFAULT '#000000',  -- Hex color
    text_align ENUM('LEFT', 'CENTER', 'RIGHT') DEFAULT 'CENTER',
    line_height DECIMAL(3,2) DEFAULT 1.2,
    text_transform ENUM('NONE', 'UPPERCASE', 'LOWERCASE', 'CAPITALIZE') DEFAULT 'NONE',
    date_format VARCHAR(50) DEFAULT 'DD MMM YYYY',  -- For date fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES certificate_templates(id) ON DELETE CASCADE,
    INDEX idx_ctf_template (template_id),
    INDEX idx_ctf_type (field_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- CERTIFICATES (Enhanced Generated & Issued)
-- =====================================================
CREATE TABLE certificates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    participation_id INT NOT NULL,
    template_id INT NOT NULL,
    certificate_number VARCHAR(100) UNIQUE,  -- Unique certificate number
    file_path VARCHAR(500),  -- Path to generated PDF
    status ENUM('DRAFT', 'GENERATED', 'RELEASED', 'REVOKED') DEFAULT 'DRAFT',
    generated_at TIMESTAMP NULL,
    released_at TIMESTAMP NULL,
    revoked_at TIMESTAMP NULL,
    revoke_reason TEXT,
    generated_by_admin_id INT DEFAULT NULL,
    released_by_admin_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (participation_id) REFERENCES participations(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES certificate_templates(id) ON DELETE RESTRICT,
    FOREIGN KEY (generated_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL,
    FOREIGN KEY (released_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL,
    UNIQUE KEY uk_participation_template (participation_id, template_id),
    INDEX idx_certificates_user (user_id),
    INDEX idx_certificates_participation (participation_id),
    INDEX idx_certificates_status (status),
    INDEX idx_certificates_number (certificate_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Migrate old data (if exists in backup tables)
-- =====================================================

-- Migrate templates
INSERT INTO certificate_templates (id, name, description, file_path, file_type, page_width, page_height, orientation, status, created_at, updated_at)
SELECT 
    id,
    name,
    NULL as description,
    file_path,
    'PDF' as file_type,
    page_width,
    page_height,
    orientation,
    'ACTIVE' as status,
    created_at,
    updated_at
FROM certificate_templates_backup
WHERE EXISTS (SELECT 1 FROM certificate_templates_backup);

-- Migrate template fields with column name mapping
INSERT INTO certificate_template_fields (
    id, template_id, field_type, x_position, y_position, width, font_size, 
    font_family, font_color, text_align, created_at
)
SELECT 
    id,
    template_id,
    field_type,
    COALESCE(x, x_coordinate, 0) as x_position,
    COALESCE(y, y_coordinate, 0) as y_position,
    COALESCE(max_width, width, 400) as width,
    COALESCE(font_size, 24) as font_size,
    COALESCE(font_family, 'Helvetica') as font_family,
    COALESCE(font_color, '#000000') as font_color,
    COALESCE(alignment, text_align, 'CENTER') as text_align,
    created_at
FROM certificate_template_fields_backup
WHERE EXISTS (SELECT 1 FROM certificate_template_fields_backup);

-- Migrate certificates with status conversion
INSERT INTO certificates (
    id, user_id, participation_id, template_id, file_path, 
    status, generated_at, released_at, created_at
)
SELECT 
    id,
    user_id,
    participation_id,
    template_id,
    COALESCE(file_path, certificate_path) as file_path,
    CASE 
        WHEN COALESCE(released, FALSE) = TRUE THEN 'RELEASED'
        WHEN file_path IS NOT NULL THEN 'GENERATED'
        ELSE 'DRAFT'
    END as status,
    created_at as generated_at,
    CASE WHEN COALESCE(released, FALSE) = TRUE THEN created_at ELSE NULL END as released_at,
    created_at
FROM certificates_backup
WHERE EXISTS (SELECT 1 FROM certificates_backup);

-- =====================================================
-- Clean up backup tables (optional - comment out if you want to keep backups)
-- =====================================================
-- DROP TABLE IF EXISTS certificates_backup;
-- DROP TABLE IF EXISTS certificate_templates_backup;
-- DROP TABLE IF EXISTS certificate_template_fields_backup;

SELECT 'Migration completed successfully!' AS status;

-- Show migration results
SELECT 
    (SELECT COUNT(*) FROM certificate_templates) as templates_count,
    (SELECT COUNT(*) FROM certificate_template_fields) as fields_count,
    (SELECT COUNT(*) FROM certificates) as certificates_count;
