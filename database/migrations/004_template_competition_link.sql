-- Add template-competition linking
-- Each competition can have one certificate template

-- Add competition_id to certificate_templates (one template per competition)
ALTER TABLE certificate_templates 
ADD COLUMN competition_id INT DEFAULT NULL,
ADD CONSTRAINT fk_template_competition 
    FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE SET NULL,
ADD INDEX idx_template_competition (competition_id);

-- Add comment for documentation
-- NOTE: A template without competition_id is a "global" template that can be used anywhere
-- A template with competition_id is linked specifically to that competition
