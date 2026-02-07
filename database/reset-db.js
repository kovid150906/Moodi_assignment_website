const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'kb@8370007067',
    multipleStatements: true // Enable multiple statements for schema execution
};

async function resetDatabase() {
    let connection;
    try {
        console.log('🚀 Starting Database Reset...');
        connection = await mysql.createConnection(dbConfig);

        // Read schema.sql
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Execute schema
        console.log('🧹 Wiping data and recreating tables...');
        await connection.query(schemaSql);

        console.log('✨ Database reset complete! All data removed and tables recreated.');
    } catch (error) {
        console.error('❌ Reset failed:', error);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

resetDatabase();
