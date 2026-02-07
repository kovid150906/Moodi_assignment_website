-- Migration: Make MI ID required and ensure it's displayed everywhere
-- Date: 2026-02-02

USE certificate_system;

-- First, check if there are any NULL mi_id values and update them
-- You may need to assign unique MI IDs to users without one before running this
-- UPDATE users SET mi_id = CONCAT('MI', LPAD(id, 6, '0')) WHERE mi_id IS NULL;

-- Alter the mi_id column to make it NOT NULL
ALTER TABLE users 
    MODIFY COLUMN mi_id VARCHAR(50) NOT NULL UNIQUE;

-- Verify the change
SELECT COUNT(*) as users_with_mi_id FROM users WHERE mi_id IS NOT NULL;
