-- Migration 006: Add ARCHIVED status to rounds table
-- This allows rounds to be archived instead of deleted

ALTER TABLE rounds 
MODIFY COLUMN status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED') DEFAULT 'PENDING';
