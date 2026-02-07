require('dotenv').config();
const { initDatabase, getPool } = require('../backend-admin/src/config/database');

async function registerKovidInAllCompetitions() {
    // Initialize database first
    await initDatabase();
    const db = getPool();
    
    try {
        console.log('🔄 Registering Kovid in all competitions...');
        
        // Get Kovid's user ID
        const [users] = await db.execute(
            'SELECT id FROM users WHERE email = ?',
            ['kovidbhatia611@gmail.com']
        );
        
        if (users.length === 0) {
            console.log('❌ Kovid not found in users table');
            return;
        }
        
        const userId = users[0].id;
        console.log(`✅ Found Kovid with user ID: ${userId}`);
        
        // Register in all competitions (Delhi city)
        const competitions = [
            { id: 1, name: 'Math Olympiad 2026' },
            { id: 2, name: 'Science Quiz 2026' },
            { id: 3, name: 'Coding Championship 2026' },
            { id: 4, name: 'Art & Creativity Contest' },
            { id: 5, name: 'Debate Competition 2026' }
        ];
        
        for (const comp of competitions) {
            try {
                await db.execute(
                    'INSERT IGNORE INTO participations (user_id, competition_id, city_id, source) VALUES (?, ?, 1, "ADMIN_ADDED")',
                    [userId, comp.id]
                );
                console.log(`✅ Registered in: ${comp.name}`);
            } catch (error) {
                console.log(`⚠️  Already registered or error in: ${comp.name}`);
            }
        }
        
        // Also add to Math Olympiad rounds if they exist
        console.log('\n🎯 Adding to Math Olympiad rounds...');
        
        // Check if there's a participation for Math Olympiad
        const [participation] = await db.execute(
            'SELECT id FROM participations WHERE user_id = ? AND competition_id = 1',
            [userId]
        );
        
        if (participation.length > 0) {
            const participationId = participation[0].id;
            
            // Add to Delhi Round 1 (should exist based on seed data)
            try {
                await db.execute(
                    'INSERT IGNORE INTO round_participations (round_id, participation_id, qualified_by) VALUES (1, ?, "MANUAL")',
                    [participationId]
                );
                console.log('✅ Added to Delhi Round 1');
            } catch (error) {
                console.log('⚠️  Error or already in Delhi Round 1');
            }
        }
        
        console.log('\n🎉 Registration complete!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        db.end();
    }
}

registerKovidInAllCompetitions();