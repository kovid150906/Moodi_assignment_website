const mysql = require('mysql2/promise');

async function makeMiIdRequired() {
    const db = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'kb@8370007067',
        database: process.env.DB_NAME || 'certificate_system'
    });

    try {
        console.log('🔍 Checking for users without mi_id...');
        
        // Check if any users have NULL or empty mi_id
        const [usersWithoutMiId] = await db.execute(
            'SELECT id, email, full_name FROM users WHERE mi_id IS NULL OR mi_id = ""'
        );

        if (usersWithoutMiId.length > 0) {
            console.log(`⚠️  Found ${usersWithoutMiId.length} users without mi_id. Assigning temporary IDs...`);
            
            // Update users with temporary MI IDs
            await db.execute(
                'UPDATE users SET mi_id = CONCAT("TEMP", LPAD(id, 6, "0")) WHERE mi_id IS NULL OR mi_id = ""'
            );
            
            console.log('✅ Temporary MI IDs assigned:');
            for (const user of usersWithoutMiId) {
                const tempId = `TEMP${String(user.id).padStart(6, '0')}`;
                console.log(`   - ${user.email}: ${tempId}`);
            }
            console.log('⚠️  NOTE: These temporary IDs should be updated with real MI IDs!');
        } else {
            console.log('✅ All users already have mi_id values');
        }

        console.log('\n🔧 Making mi_id NOT NULL and UNIQUE...');
        
        // Make mi_id required and unique
        await db.execute(
            'ALTER TABLE users MODIFY COLUMN mi_id VARCHAR(50) NOT NULL UNIQUE'
        );
        
        console.log('✅ mi_id is now required and unique for all users');
        console.log('\n📋 Summary:');
        console.log('   - mi_id field is now mandatory (NOT NULL)');
        console.log('   - mi_id must be unique across all users');
        console.log('   - All new users must provide an mi_id during registration');
        
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            console.error('❌ Error: Duplicate mi_id values found!');
            console.error('   Some users have the same mi_id. Please fix duplicates before running this migration.');
        } else {
            console.error('❌ Migration failed:', error.message);
        }
        throw error;
    } finally {
        await db.end();
    }
}

makeMiIdRequired();
