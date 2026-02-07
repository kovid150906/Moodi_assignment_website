-- Migration 007: Make mi_id required and unique for all users
-- This enforces that every user must have a unique MI ID

-- First, update any NULL mi_id values with a placeholder
-- (In a real scenario, these should be reviewed and fixed manually)
UPDATE users 
SET mi_id = CONCAT('TEMP', LPAD(id, 6, '0')) 
WHERE mi_id IS NULL OR mi_id = '';

-- Now make mi_id NOT NULL and ensure it's unique
ALTER TABLE users 
MODIFY COLUMN mi_id VARCHAR(50) NOT NULL UNIQUE;
