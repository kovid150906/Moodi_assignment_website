const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'kb@8370007067',
    database: 'certificate_system'
};

async function migrateDatabase() {
    console.log('🚀 Starting migration...');

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);

        // 1. Make start_date and end_date nullable in competitions table
        console.log('📦 Modifying competitions table (dates)...');
        await connection.query('ALTER TABLE competitions MODIFY COLUMN start_date DATE NULL');
        await connection.query('ALTER TABLE competitions MODIFY COLUMN end_date DATE NULL');

        // 2. Add event_date to competitions if not exists (for backward compatibility or main date)
        // Checking if column exists first
        const [columns] = await connection.query("SHOW COLUMNS FROM competitions LIKE 'event_date'");
        if (columns.length === 0) {
            console.log('📦 Adding event_date to competitions...');
            await connection.query('ALTER TABLE competitions ADD COLUMN event_date DATE NULL AFTER description');
        }

        // 3. Update status ENUM (simplified: status = competition phase, registration_open = boolean)
        console.log('📦 Updating status enum...');
        await connection.query(`
            ALTER TABLE competitions 
            MODIFY COLUMN status 
            ENUM('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED') 
            DEFAULT 'DRAFT'
        `);

        // 4. Ensure event_date exists in competition_cities
        console.log('📦 Checking competition_cities table...');
        const [ccColumns] = await connection.query("SHOW COLUMNS FROM competition_cities LIKE 'event_date'");
        if (ccColumns.length === 0) {
            console.log('📦 Adding event_date to competition_cities...');
            await connection.query('ALTER TABLE competition_cities ADD COLUMN event_date DATE NULL');
        }

        console.log('✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrateDatabase();
