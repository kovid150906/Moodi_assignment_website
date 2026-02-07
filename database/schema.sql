-- Certificate Distribution System Database Schema
-- MySQL 8.0+

-- Create database
DROP DATABASE IF EXISTS certificate_system;
CREATE DATABASE IF NOT EXISTS certificate_system;
USE certificate_system;

-- =====================================================
-- USERS TABLE (Participants)
-- =====================================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    mi_id VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    status ENUM('ACTIVE', 'SUSPENDED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email),
    INDEX idx_users_mi_id (mi_id),
    INDEX idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- ADMINS TABLE (System Operators)
-- =====================================================
CREATE TABLE admins (
    id INT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'COORDINATOR') NOT NULL DEFAULT 'COORDINATOR',
    status ENUM('ACTIVE', 'SUSPENDED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_admins_email (email),
    INDEX idx_admins_role (role),
    INDEX idx_admins_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- COMPETITIONS TABLE
-- =====================================================
CREATE TABLE competitions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    event_date DATE,
    registration_open BOOLEAN DEFAULT FALSE,
    status ENUM('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED') DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_competitions_status (status),
    INDEX idx_competitions_registration (registration_open)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- CITIES TABLE
-- =====================================================
CREATE TABLE cities (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cities_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- COMPETITION-CITY MAPPING
-- =====================================================
CREATE TABLE competition_cities (
    id INT PRIMARY KEY AUTO_INCREMENT,
    competition_id INT NOT NULL,
    city_id INT NOT NULL,
    event_date DATE,
    registration_open BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
    FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE,
    UNIQUE KEY uk_competition_city (competition_id, city_id),
    INDEX idx_cc_competition (competition_id),
    INDEX idx_cc_city (city_id),
    INDEX idx_cc_registration (registration_open)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- PARTICIPATIONS (User Registration for Competitions)
-- =====================================================
CREATE TABLE participations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    competition_id INT NOT NULL,
    city_id INT NOT NULL,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source ENUM('USER_SELF', 'ADMIN_ADDED') DEFAULT 'USER_SELF',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
    FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_competition_city (user_id, competition_id, city_id),
    INDEX idx_participations_user (user_id),
    INDEX idx_participations_competition (competition_id),
    INDEX idx_participations_city (city_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- RESULTS TABLE
-- =====================================================
CREATE TABLE results (
    id INT PRIMARY KEY AUTO_INCREMENT,
    participation_id INT NOT NULL UNIQUE,
    result_status ENUM('PARTICIPATED', 'WINNER') DEFAULT 'PARTICIPATED',
    position INT DEFAULT NULL,
    locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (participation_id) REFERENCES participations(id) ON DELETE CASCADE,
    INDEX idx_results_status (result_status),
    INDEX idx_results_locked (locked)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- CERTIFICATE TEMPLATES
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
-- CERTIFICATE TEMPLATE FIELDS (Dynamic Text Positioning)
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
-- CERTIFICATES (Generated & Issued)
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
-- USER REFRESH TOKENS
-- =====================================================
CREATE TABLE user_refresh_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_urt_user (user_id),
    INDEX idx_urt_token (token(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- ADMIN REFRESH TOKENS
-- =====================================================
CREATE TABLE admin_refresh_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    admin_id INT NOT NULL,
    token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    INDEX idx_art_admin (admin_id),
    INDEX idx_art_token (token(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- AUDIT LOGS
-- =====================================================
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    admin_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT,
    details JSON,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    INDEX idx_audit_admin (admin_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- ROUNDS TABLE (City-specific rounds for multi-round competitions)
-- =====================================================
CREATE TABLE rounds (
    id INT PRIMARY KEY AUTO_INCREMENT,
    competition_id INT NOT NULL,
    city_id INT NOT NULL,
    round_number INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    round_date DATE DEFAULT NULL,
    is_finale BOOLEAN DEFAULT FALSE,
    status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED') DEFAULT 'PENDING',
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
CREATE TABLE round_participations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    round_id INT NOT NULL,
    participation_id INT NOT NULL,
    qualified_by ENUM('AUTOMATIC', 'MANUAL') DEFAULT 'AUTOMATIC',
    added_by_admin_id INT DEFAULT NULL,
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
CREATE TABLE round_scores (
    id INT PRIMARY KEY AUTO_INCREMENT,
    round_participation_id INT NOT NULL,
    score DECIMAL(10,2) DEFAULT NULL,
    rank_in_round INT DEFAULT NULL,
    is_winner BOOLEAN DEFAULT FALSE,
    winner_position INT DEFAULT NULL,
    notes TEXT,
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
-- SEED DATA: Default Admin
-- =====================================================
-- Password: Admin@123 (bcrypt hash)
INSERT INTO admins (full_name, email, password_hash, role, status) VALUES 
('Super Admin', 'admin@system.com', '$2b$10$rQZ7.HxGGMmxqvtFWvfK8.AqGz5V5CWvq7nH5CW.yWWg0qK8K3Kq2', 'ADMIN', 'ACTIVE');

-- =====================================================
-- SEED DATA: Sample Cities
-- =====================================================
INSERT INTO cities (name, status) VALUES 
('Mumbai', 'ACTIVE'),
('Delhi', 'ACTIVE'),
('Bangalore', 'ACTIVE'),
('Chennai', 'ACTIVE'),
('Kolkata', 'ACTIVE'),
('Hyderabad', 'ACTIVE'),
('Pune', 'ACTIVE'),
('Ahmedabad', 'ACTIVE');

SELECT 'Database reset and seeded successfully!' AS status;
