-- Add RANK, SCORE, and ROUND to certificate_template_fields field_type enum

USE certificate_system;

ALTER TABLE certificate_template_fields 
MODIFY COLUMN field_type ENUM('NAME', 'COMPETITION', 'CITY', 'DATE', 'RESULT', 'POSITION', 'MI_ID', 'RANK', 'SCORE', 'ROUND') NOT NULL;
