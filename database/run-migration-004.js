/**
 * Run migration 004: Add template-competition linking
 */
const path = require('path');
const backendPath = path.join(__dirname, '../backend-admin');

// Use modules from backend-admin
require(path.join(backendPath, 'node_modules/dotenv')).config({
    path: path.join(backendPath, '.env')
});

const mysql = require(path.join(backendPath, 'node_modules/mysql2/promise'));

async function runMigration() {
    console.log('Running migration 004: Add template-competition linking...');
    console.log('DB Host:', process.env.DB_HOST || 'localhost');

    const pool = await mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'certificate_system',
        waitForConnections: true,
        connectionLimit: 1
    });

    try {
        // Check if column already exists
        const [columns] = await pool.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'certificate_templates' 
            AND COLUMN_NAME = 'competition_id'
        `);

        if (columns.length > 0) {
            console.log('Column competition_id already exists. Skipping migration.');
        } else {
            // Add competition_id column
            await pool.execute(`
                ALTER TABLE certificate_templates 
                ADD COLUMN competition_id INT DEFAULT NULL
            `);
            console.log('Added competition_id column.');

            // Add foreign key
            await pool.execute(`
                ALTER TABLE certificate_templates
                ADD CONSTRAINT fk_template_competition 
                    FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE SET NULL
            `);
            console.log('Added foreign key constraint.');

            // Add index
            await pool.execute(`
                ALTER TABLE certificate_templates
                ADD INDEX idx_template_competition (competition_id)
            `);
            console.log('Added index.');
        }

        console.log('Migration 004 completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

runMigration().catch(console.error);
