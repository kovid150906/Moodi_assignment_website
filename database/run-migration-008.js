const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'certificate_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

async function runMigration() {
    let connection;
    
    try {
        console.log('🔌 Connecting to database...');
        connection = await mysql.createConnection(config);
        console.log('✅ Connected\n');

        console.log('🔄 Running Migration 008: Add per-city registration control...');
        
        // Add registration_open column
        console.log('   ├─ Adding registration_open column to competition_cities...');
        await connection.query(`
            ALTER TABLE competition_cities 
            ADD COLUMN registration_open BOOLEAN DEFAULT TRUE AFTER event_date
        `);
        
        // Close registration for finished cities
        console.log('   ├─ Closing registration for finished cities...');
        const [result] = await connection.query(`
            UPDATE competition_cities cc
            SET registration_open = FALSE
            WHERE EXISTS (
                SELECT 1 FROM results r
                JOIN participations p ON p.id = r.participation_id
                WHERE p.competition_id = cc.competition_id 
                AND p.city_id = cc.city_id 
                AND r.result_status = 'WINNER'
            )
        `);
        console.log(`   ├─ Closed registration for ${result.affectedRows} cities`);
        
        // Add index
        console.log('   ├─ Adding index...');
        await connection.query(`
            CREATE INDEX idx_cc_registration ON competition_cities(registration_open)
        `);
        
        console.log('✅ Migration 008 completed successfully!\n');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

runMigration();
