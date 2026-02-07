const mysql = require('mysql2/promise');

async function addArchivedStatus() {
    const db = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'kb@8370007067',
        database: process.env.DB_NAME || 'certificate_system'
    });

    try {
        await db.execute(`
            ALTER TABLE rounds 
            MODIFY COLUMN status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED') DEFAULT 'PENDING'
        `);
        console.log('✅ ARCHIVED status added to rounds table');
    } catch (error) {
        if (error.code === 'ER_DUPLICATED_VALUE_IN_TYPE') {
            console.log('✅ ARCHIVED status already exists');
        } else {
            console.error('❌ Error:', error.message);
        }
    } finally {
        await db.end();
    }
}

addArchivedStatus();
