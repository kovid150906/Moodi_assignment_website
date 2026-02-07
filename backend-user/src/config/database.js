const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'kb@8370007067',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const dbName = process.env.DB_NAME || 'certificate_system';

let pool = null;

const createTables = async (connection) => {
  console.log('📝 Creating database tables...');

  const tables = [
    // Users
    `CREATE TABLE IF NOT EXISTS users (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Admins
    `CREATE TABLE IF NOT EXISTS admins (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Competitions
    `CREATE TABLE IF NOT EXISTS competitions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      registration_open BOOLEAN DEFAULT FALSE,
      status ENUM('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED') DEFAULT 'DRAFT',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_competitions_status (status),
      INDEX idx_competitions_registration (registration_open)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Cities
    `CREATE TABLE IF NOT EXISTS cities (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cities_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Competition Cities
    `CREATE TABLE IF NOT EXISTS competition_cities (
      id INT PRIMARY KEY AUTO_INCREMENT,
      competition_id INT NOT NULL,
      city_id INT NOT NULL,
      event_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
      FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE,
      UNIQUE KEY uk_competition_city (competition_id, city_id),
      INDEX idx_cc_competition (competition_id),
      INDEX idx_cc_city (city_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Participations
    `CREATE TABLE IF NOT EXISTS participations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      competition_id INT NOT NULL,
      city_id INT NOT NULL,
      registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      source ENUM('USER_SELF', 'ADMIN_ADDED') DEFAULT 'USER_SELF',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
      FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE,
      UNIQUE KEY uk_user_competition (user_id, competition_id),
      INDEX idx_participations_user (user_id),
      INDEX idx_participations_competition (competition_id),
      INDEX idx_participations_city (city_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Results
    `CREATE TABLE IF NOT EXISTS results (
      id INT PRIMARY KEY AUTO_INCREMENT,
      participation_id INT NOT NULL UNIQUE,
      result_status ENUM('PARTICIPATED', 'WINNER') DEFAULT 'PARTICIPATED',
      position INT DEFAULT NULL,
      score DECIMAL(10,2) DEFAULT NULL,
      locked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (participation_id) REFERENCES participations(id) ON DELETE CASCADE,
      INDEX idx_results_status (result_status),
      INDEX idx_results_locked (locked)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Certificate Templates
    `CREATE TABLE IF NOT EXISTS certificate_templates (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      is_dynamic BOOLEAN DEFAULT FALSE,
      page_width INT DEFAULT 842,
      page_height INT DEFAULT 595,
      orientation ENUM('LANDSCAPE', 'PORTRAIT') DEFAULT 'LANDSCAPE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Certificate Template Fields
    `CREATE TABLE IF NOT EXISTS certificate_template_fields (
      id INT PRIMARY KEY AUTO_INCREMENT,
      template_id INT NOT NULL,
      field_type ENUM('NAME', 'COMPETITION', 'CITY', 'DATE', 'RESULT', 'POSITION') NOT NULL,
      x INT NOT NULL DEFAULT 0,
      y INT NOT NULL DEFAULT 0,
      font_size INT DEFAULT 24,
      font_family VARCHAR(100) DEFAULT 'Helvetica',
      font_color VARCHAR(20) DEFAULT '#000000',
      alignment ENUM('LEFT', 'CENTER', 'RIGHT') DEFAULT 'CENTER',
      max_width INT DEFAULT 400,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES certificate_templates(id) ON DELETE CASCADE,
      INDEX idx_ctf_template (template_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Certificates
    `CREATE TABLE IF NOT EXISTS certificates (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      participation_id INT NOT NULL,
      template_id INT NOT NULL,
      file_path VARCHAR(500),
      released BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (participation_id) REFERENCES participations(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES certificate_templates(id) ON DELETE CASCADE,
      INDEX idx_certificates_user (user_id),
      INDEX idx_certificates_released (released)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // User Refresh Tokens
    `CREATE TABLE IF NOT EXISTS user_refresh_tokens (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      token VARCHAR(500) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_urt_user (user_id),
      INDEX idx_urt_token (token(255))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Admin Refresh Tokens
    `CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
      id INT PRIMARY KEY AUTO_INCREMENT,
      admin_id INT NOT NULL,
      token VARCHAR(500) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
      INDEX idx_art_admin (admin_id),
      INDEX idx_art_token (token(255))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Audit Logs
    `CREATE TABLE IF NOT EXISTS audit_logs (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Rounds (for multi-round competitions)
    `CREATE TABLE IF NOT EXISTS rounds (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Round Participations
    `CREATE TABLE IF NOT EXISTS round_participations (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Round Scores
    `CREATE TABLE IF NOT EXISTS round_scores (
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
      INDEX idx_rs_score (score)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  ];

  // Create each table
  for (let i = 0; i < tables.length; i++) {
    try {
      await connection.query(tables[i]);
      console.log(`  ✓ Table ${i + 1}/${tables.length} created`);
    } catch (err) {
      if (!err.message.includes('already exists')) {
        console.log(`  ✗ Table ${i + 1} error: ${err.message}`);
      }
    }
  }

  // Seed data
  try {
    await connection.query(`
      INSERT IGNORE INTO admins (full_name, email, password_hash, role, status) VALUES 
      ('Super Admin', 'admin@system.com', '$2b$10$rQZ7.HxGGMmxqvtFWvfK8.AqGz5V5CWvq7nH5CW.yWWg0qK8K3Kq2', 'ADMIN', 'ACTIVE')
    `);
    console.log('  ✓ Default admin created');
  } catch (err) { /* ignore */ }

  try {
    await connection.query(`
      INSERT IGNORE INTO cities (name, status) VALUES 
      ('Mumbai', 'ACTIVE'), ('Delhi', 'ACTIVE'), ('Bangalore', 'ACTIVE'),
      ('Chennai', 'ACTIVE'), ('Kolkata', 'ACTIVE'), ('Hyderabad', 'ACTIVE'),
      ('Pune', 'ACTIVE'), ('Ahmedabad', 'ACTIVE')
    `);
    console.log('  ✓ Cities seeded');
  } catch (err) { /* ignore */ }

  console.log('✅ Database tables created successfully!');
};

const initDatabase = async () => {
  try {
    // Connect without database first
    const tempConnection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });

    // Create database if not exists
    await tempConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );

    // Switch to the database
    await tempConnection.query(`USE \`${dbName}\``);

    // Check if users table exists
    const [tables] = await tempConnection.query(
      `SHOW TABLES LIKE 'users'`
    );

    if (tables.length === 0) {
      console.log(`⚠️  Tables not found in database '${dbName}'`);
      await createTables(tempConnection);
    }

    await tempConnection.end();

    // Create connection pool
    pool = mysql.createPool({
      ...dbConfig,
      database: dbName
    });

    // Test connection
    const testConn = await pool.getConnection();
    console.log('✅ Database connected successfully');
    testConn.release();

    return pool;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return pool;
};

module.exports = { initDatabase, getPool };
