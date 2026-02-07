-- Quick fix: Add missing columns to existing tables
-- Run this if you don't want to reset the entire database

USE certificate_system;

-- Add missing columns to certificate_templates if they don't exist
ALTER TABLE certificate_templates 
ADD COLUMN IF NOT EXISTS description TEXT AFTER name,
ADD COLUMN IF NOT EXISTS file_type ENUM('PDF', 'PNG', 'JPG', 'SVG') DEFAULT 'PDF' AFTER file_path,
ADD COLUMN IF NOT EXISTS status ENUM('ACTIVE', 'ARCHIVED') DEFAULT 'ACTIVE' AFTER orientation,
ADD COLUMN IF NOT EXISTS created_by_admin_id INT DEFAULT NULL AFTER status,
ADD INDEX IF NOT EXISTS idx_ct_status (status),
ADD INDEX IF NOT EXISTS idx_ct_competition (competition_id);

-- Add foreign key if it doesn't exist
ALTER TABLE certificate_templates 
ADD CONSTRAINT fk_template_admin 
FOREIGN KEY (created_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL;

-- Update certificate_template_fields to add new columns
ALTER TABLE certificate_template_fields
ADD COLUMN IF NOT EXISTS field_label VARCHAR(100) AFTER field_type,
ADD COLUMN IF NOT EXISTS x_position INT NOT NULL DEFAULT 0 AFTER field_label,
ADD COLUMN IF NOT EXISTS y_position INT NOT NULL DEFAULT 0 AFTER x_position,
ADD COLUMN IF NOT EXISTS width INT DEFAULT 400 AFTER y_position,
ADD COLUMN IF NOT EXISTS height INT DEFAULT 50 AFTER width,
ADD COLUMN IF NOT EXISTS font_weight ENUM('NORMAL', 'BOLD', 'LIGHT') DEFAULT 'NORMAL' AFTER font_family,
ADD COLUMN IF NOT EXISTS text_align ENUM('LEFT', 'CENTER', 'RIGHT') DEFAULT 'CENTER' AFTER font_color,
ADD COLUMN IF NOT EXISTS line_height DECIMAL(3,2) DEFAULT 1.2 AFTER text_align,
ADD COLUMN IF NOT EXISTS text_transform ENUM('NONE', 'UPPERCASE', 'LOWERCASE', 'CAPITALIZE') DEFAULT 'NONE' AFTER line_height,
ADD COLUMN IF NOT EXISTS date_format VARCHAR(50) DEFAULT 'DD MMM YYYY' AFTER text_transform;

-- Copy data from old columns to new columns if they exist
UPDATE certificate_template_fields 
SET x_position = COALESCE(x, 0) WHERE x_position = 0 AND x IS NOT NULL;

UPDATE certificate_template_fields 
SET y_position = COALESCE(y, 0) WHERE y_position = 0 AND y IS NOT NULL;

UPDATE certificate_template_fields 
SET width = COALESCE(max_width, 400) WHERE width = 400 AND max_width IS NOT NULL;

UPDATE certificate_template_fields 
SET text_align = UPPER(COALESCE(alignment, 'CENTER')) WHERE alignment IS NOT NULL;

-- Add missing columns to certificates table
ALTER TABLE certificates
ADD COLUMN IF NOT EXISTS certificate_number VARCHAR(100) UNIQUE AFTER template_id,
ADD COLUMN IF NOT EXISTS status ENUM('DRAFT', 'GENERATED', 'RELEASED', 'REVOKED') DEFAULT 'DRAFT' AFTER file_path,
ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP NULL AFTER status,
ADD COLUMN IF NOT EXISTS released_at TIMESTAMP NULL AFTER generated_at,
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP NULL AFTER released_at,
ADD COLUMN IF NOT EXISTS revoke_reason TEXT AFTER revoked_at,
ADD COLUMN IF NOT EXISTS generated_by_admin_id INT DEFAULT NULL AFTER revoke_reason,
ADD COLUMN IF NOT EXISTS released_by_admin_id INT DEFAULT NULL AFTER generated_by_admin_id,
ADD INDEX IF NOT EXISTS idx_certificates_status (status),
ADD INDEX IF NOT EXISTS idx_certificates_number (certificate_number);

-- Update existing certificates to have proper status
UPDATE certificates 
SET status = CASE 
    WHEN released = TRUE THEN 'RELEASED'
    WHEN file_path IS NOT NULL THEN 'GENERATED'
    ELSE 'DRAFT'
END
WHERE status = 'DRAFT' AND released IS NOT NULL;

UPDATE certificates 
SET released_at = created_at 
WHERE released = TRUE AND released_at IS NULL;

-- Add foreign keys if they don't exist
ALTER TABLE certificates 
ADD CONSTRAINT fk_cert_generated_admin 
FOREIGN KEY (generated_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL;

ALTER TABLE certificates 
ADD CONSTRAINT fk_cert_released_admin 
FOREIGN KEY (released_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL;

-- Add CUSTOM to field_type enum if not exists
ALTER TABLE certificate_template_fields 
MODIFY COLUMN field_type ENUM('NAME', 'COMPETITION', 'CITY', 'DATE', 'RESULT', 'POSITION', 'MI_ID', 'CUSTOM') NOT NULL;

SELECT 'Migration completed! Database schema updated.' AS status;
