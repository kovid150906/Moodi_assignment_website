-- Migration 008: Add per-city registration control
-- This allows closing registration for individual cities when they finish

ALTER TABLE competition_cities 
ADD COLUMN registration_open BOOLEAN DEFAULT TRUE AFTER event_date;

-- Set registration closed for cities that already have results (finished cities)
UPDATE competition_cities cc
SET registration_open = FALSE
WHERE EXISTS (
    SELECT 1 FROM results r
    JOIN participations p ON p.id = r.participation_id
    WHERE p.competition_id = cc.competition_id 
    AND p.city_id = cc.city_id 
    AND r.result_status = 'WINNER'
);

-- Add index for faster queries
CREATE INDEX idx_cc_registration ON competition_cities(registration_open);
