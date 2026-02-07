const mysql = require('../backend-admin/node_modules/mysql2/promise');

async function runMigration() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: 'kb@8370007067',
            database: 'certificate_system'
        });

        console.log('Connected to database...');

        await connection.execute(`
            ALTER TABLE certificate_template_fields 
            MODIFY COLUMN field_type ENUM(
                'NAME', 'COMPETITION', 'CITY', 'DATE', 'RESULT', 'POSITION', 
                'MI_ID', 'RANK', 'SCORE', 'ROUND'
            ) NOT NULL
        `);

        console.log('✓ Field types updated: RANK, SCORE, and ROUND added');
        
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

runMigration();
