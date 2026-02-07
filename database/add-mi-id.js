const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'kb@8370007067',
    database: 'certificate_system'
};

async function migrate() {
    let connection;
    try {
        console.log('🚀 Starting MI ID migration...');
        connection = await mysql.createConnection(dbConfig);

        // Add mi_id column
        // We make it nullable first to avoid issues with existing records
        // But logical constraint is unique
        try {
            await connection.execute(`
                ALTER TABLE users 
                ADD COLUMN mi_id VARCHAR(50) UNIQUE DEFAULT NULL AFTER id
            `);
            console.log('✅ Added mi_id column to users table');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️ mi_id column already exists');
            } else {
                throw error;
            }
        }

        // Add index explicitly if not added by UNIQUE constraint (it usually is)

        console.log('✨ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
