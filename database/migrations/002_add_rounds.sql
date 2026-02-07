-- Multi-Round Competition System Migration
-- Each city runs rounds independently with city-specific dates

-- =====================================================
-- ROUNDS TABLE (City-specific rounds)
-- =====================================================
CREATE TABLE IF NOT EXISTS rounds (
    id INT PRIMARY KEY AUTO_INCREMENT,
    competition_id INT NOT NULL,
    city_id INT NOT NULL,  -- Each city has its own rounds
    round_number INT NOT NULL,
    name VARCHAR(255) NOT NULL,  -- e.g., "Audition", "Semi-Final", "Finale"
    round_date DATE DEFAULT NULL,  -- Defaults from event_date, can be changed
    is_finale BOOLEAN DEFAULT FALSE,
    status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
    FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE,
    UNIQUE KEY uk_competition_city_round (competition_id, city_id, round_number),
    INDEX idx_rounds_competition (competition_id),
    INDEX idx_rounds_city (city_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- ROUND PARTICIPATIONS (who is in each round)
-- =====================================================
CREATE TABLE IF NOT EXISTS round_participations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    round_id INT NOT NULL,
    participation_id INT NOT NULL,  -- Links to original registration
    qualified_by ENUM('AUTOMATIC', 'MANUAL') DEFAULT 'AUTOMATIC',
    added_by_admin_id INT DEFAULT NULL,  -- If manually added
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
    FOREIGN KEY (participation_id) REFERENCES participations(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL,
    UNIQUE KEY uk_round_participation (round_id, participation_id),
    INDEX idx_rp_round (round_id),
    INDEX idx_rp_participation (participation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- ROUND SCORES (marks for each participant in each round)
-- =====================================================
CREATE TABLE IF NOT EXISTS round_scores (
    id INT PRIMARY KEY AUTO_INCREMENT,
    round_participation_id INT NOT NULL,
    score DECIMAL(10,2) DEFAULT NULL,  -- Null if not yet scored
    rank_in_round INT DEFAULT NULL,    -- Calculated after scoring
    is_winner BOOLEAN DEFAULT FALSE,   -- Only for finale
    winner_position INT DEFAULT NULL,  -- 1st, 2nd, 3rd place
    notes TEXT,                        -- Optional notes from judges
    scored_by_admin_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (round_participation_id) REFERENCES round_participations(id) ON DELETE CASCADE,
    FOREIGN KEY (scored_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL,
    UNIQUE KEY uk_round_participation_score (round_participation_id),
    INDEX idx_rs_round_participation (round_participation_id),
    INDEX idx_rs_score (score DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- MIGRATION: Add existing participations to Round 1
-- This will be run after rounds are created for existing competitions
-- =====================================================
-- Note: Run this procedure after creating Round 1 for each competition-city

DELIMITER //
CREATE PROCEDURE IF NOT EXISTS migrate_participations_to_round1()
BEGIN
    -- For each competition-city pair that has participations but no rounds
    INSERT INTO rounds (competition_id, city_id, round_number, name, round_date, status)
    SELECT DISTINCT 
        p.competition_id,
        p.city_id,
        1 as round_number,
        'Round 1' as name,
        cc.event_date as round_date,
        'PENDING' as status
    FROM participations p
    JOIN competition_cities cc ON cc.competition_id = p.competition_id AND cc.city_id = p.city_id
    WHERE NOT EXISTS (
        SELECT 1 FROM rounds r 
        WHERE r.competition_id = p.competition_id 
        AND r.city_id = p.city_id 
        AND r.round_number = 1
    );
    
    -- Add all existing participations to their Round 1
    INSERT INTO round_participations (round_id, participation_id, qualified_by)
    SELECT 
        r.id as round_id,
        p.id as participation_id,
        'AUTOMATIC' as qualified_by
    FROM participations p
    JOIN rounds r ON r.competition_id = p.competition_id 
        AND r.city_id = p.city_id 
        AND r.round_number = 1
    WHERE NOT EXISTS (
        SELECT 1 FROM round_participations rp 
        WHERE rp.round_id = r.id AND rp.participation_id = p.id
    );
END //
DELIMITER ;

-- Run the migration
CALL migrate_participations_to_round1();

SELECT 'Multi-round tables created and existing data migrated!' AS status;
