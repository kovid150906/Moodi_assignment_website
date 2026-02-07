-- Migration 009: Add FINALIST status to results table
-- This allows distinguishing between competition winners (position 1) and other finalists (position 2+)

ALTER TABLE results 
MODIFY COLUMN result_status ENUM('PARTICIPATED', 'FINALIST', 'WINNER') DEFAULT 'PARTICIPATED';
