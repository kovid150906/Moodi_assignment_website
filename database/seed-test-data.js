/**
 * Comprehensive Test Data Seeder
 * Seeds all tables with realistic test data for full system testing
 * 
 * Usage: node seed-test-data.js
 */

require('dotenv').config({ path: '../backend-admin/.env' });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'certificate_system',
    waitForConnections: true,
    connectionLimit: 10,
};

async function seed() {
    const pool = mysql.createPool(config);
    
    console.log('🌱 Starting database seeding...\n');

    try {
        // =====================================================
        // CLEAR EXISTING DATA (in correct order due to FK constraints)
        // =====================================================
        console.log('🗑️  Clearing existing data...');
        await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
        await pool.execute('TRUNCATE TABLE certificates');
        await pool.execute('TRUNCATE TABLE round_scores');
        await pool.execute('TRUNCATE TABLE round_participations');
        await pool.execute('TRUNCATE TABLE rounds');
        await pool.execute('TRUNCATE TABLE results');
        await pool.execute('TRUNCATE TABLE participations');
        await pool.execute('TRUNCATE TABLE competition_cities');
        await pool.execute('TRUNCATE TABLE competitions');
        await pool.execute('TRUNCATE TABLE cities');
        await pool.execute('TRUNCATE TABLE user_refresh_tokens');
        await pool.execute('TRUNCATE TABLE admin_refresh_tokens');
        await pool.execute('TRUNCATE TABLE users');
        await pool.execute('TRUNCATE TABLE admins');
        await pool.execute('TRUNCATE TABLE audit_logs');
        await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('✅ Existing data cleared\n');

        // =====================================================
        // SEED ADMINS
        // =====================================================
        console.log('👤 Creating admins...');
        const adminPassword = await bcrypt.hash('Admin@123', 10);
        const systemAdminPassword = await bcrypt.hash('Admin@123', 10);
        const coordPassword = await bcrypt.hash('Coord@123', 10);

        await pool.execute(`
            INSERT INTO admins (full_name, email, password_hash, role, status) VALUES
            ('Super Admin', 'admin@test.com', ?, 'ADMIN', 'ACTIVE'),
            ('System Admin', 'admin@system.com', ?, 'ADMIN', 'ACTIVE'),
            ('Delhi Coordinator', 'delhi.coord@test.com', ?, 'COORDINATOR', 'ACTIVE'),
            ('Mumbai Coordinator', 'mumbai.coord@test.com', ?, 'COORDINATOR', 'ACTIVE'),
            ('Bangalore Coordinator', 'bangalore.coord@test.com', ?, 'COORDINATOR', 'ACTIVE')
        `, [adminPassword, systemAdminPassword, coordPassword, coordPassword, coordPassword]);
        console.log('✅ Created 5 admins (2 admins + 3 coordinators)\n');

        // =====================================================
        // SEED CITIES
        // =====================================================
        console.log('🏙️  Creating cities...');
        await pool.execute(`
            INSERT INTO cities (name, status) VALUES
            ('Delhi', 'ACTIVE'),
            ('Mumbai', 'ACTIVE'),
            ('Bangalore', 'ACTIVE'),
            ('Chennai', 'ACTIVE'),
            ('Kolkata', 'ACTIVE'),
            ('Hyderabad', 'ACTIVE')
        `);
        console.log('✅ Created 6 cities\n');

        // =====================================================
        // SEED USERS (with MI IDs)
        // =====================================================
        console.log('👥 Creating users...');
        const userPassword = await bcrypt.hash('User@123', 10);
        
        const users = [];
        const cities = ['Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad'];
        const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
                           'Ananya', 'Diya', 'Saanvi', 'Aanya', 'Aadhya', 'Pihu', 'Pari', 'Myra', 'Kiara', 'Sara',
                           'Rohan', 'Kabir', 'Arnav', 'Dhruv', 'Advait', 'Yash', 'Shaurya', 'Atharv', 'Aayan', 'Veer'];
        const lastNames = ['Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Reddy', 'Nair', 'Iyer', 'Menon', 'Joshi'];

        for (let i = 1; i <= 50; i++) {
            const firstName = firstNames[(i - 1) % firstNames.length];
            const lastName = lastNames[(i - 1) % lastNames.length];
            const miId = `MI${String(i).padStart(6, '0')}`;
            const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@test.com`;
            users.push([miId, `${firstName} ${lastName}`, email, userPassword, 'ACTIVE']);
        }

        for (const user of users) {
            await pool.execute(
                'INSERT INTO users (mi_id, full_name, email, password_hash, status) VALUES (?, ?, ?, ?, ?)',
                user
            );
        }

        // Add Kovid as a special user
        const kovidPassword = await bcrypt.hash('Abcd1234', 10);
        await pool.execute(
            'INSERT INTO users (mi_id, full_name, email, password_hash, status) VALUES (?, ?, ?, ?, ?)',
            ['MIkov1234', 'Kovid Bhatia', 'kovidbhatia611@gmail.com', kovidPassword, 'ACTIVE']
        );
        console.log('✅ Created 50 users with MI IDs + Kovid\n');

        // =====================================================
        // SEED COMPETITIONS
        // =====================================================
        console.log('🏆 Creating competitions...');
        // Status: DRAFT, ACTIVE, COMPLETED, CANCELLED, ARCHIVED
        // registration_open: TRUE/FALSE (independent of status)
        await pool.execute(`
            INSERT INTO competitions (name, description, start_date, end_date, event_date, registration_open, status) VALUES
            ('Math Olympiad 2026', 'Annual Mathematics Olympiad for students', '2026-01-01', '2026-03-31', '2026-02-15', FALSE, 'ACTIVE'),
            ('Science Quiz 2026', 'National Science Quiz Competition', '2026-01-15', '2026-04-15', '2026-03-01', TRUE, 'ACTIVE'),
            ('Coding Championship 2026', 'Programming and Algorithm Challenge', '2026-02-01', '2026-05-01', '2026-04-01', TRUE, 'ACTIVE'),
            ('Art & Creativity Contest', 'Creative Arts Competition', '2025-10-01', '2025-12-31', '2025-12-15', FALSE, 'COMPLETED'),
            ('Debate Competition 2026', 'Inter-city Debate Championship', '2026-03-01', '2026-06-01', '2026-05-15', FALSE, 'DRAFT')
        `);
        console.log('✅ Created 5 competitions\n');

        // =====================================================
        // SEED COMPETITION-CITY MAPPINGS
        // =====================================================
        console.log('🔗 Linking competitions to cities...');
        // Math Olympiad - Delhi, Mumbai, Bangalore
        await pool.execute(`
            INSERT INTO competition_cities (competition_id, city_id, event_date) VALUES
            (1, 1, '2026-02-15'), (1, 2, '2026-02-16'), (1, 3, '2026-02-17'),
            (2, 1, '2026-03-01'), (2, 2, '2026-03-02'), (2, 3, '2026-03-03'), (2, 4, '2026-03-04'),
            (3, 1, '2026-04-01'), (3, 2, '2026-04-02'), (3, 3, '2026-04-03'),
            (4, 1, '2025-12-15'), (4, 2, '2025-12-16'),
            (5, 1, '2026-05-15'), (5, 2, '2026-05-16'), (5, 3, '2026-05-17')
        `);
        console.log('✅ Linked competitions to cities\n');

        // =====================================================
        // SEED PARTICIPATIONS
        // =====================================================
        console.log('📝 Creating participations...');
        
        // Math Olympiad: 30 participants across 3 cities
        for (let i = 1; i <= 10; i++) {
            await pool.execute(
                'INSERT INTO participations (user_id, competition_id, city_id, source) VALUES (?, 1, 1, ?)',
                [i, i % 2 === 0 ? 'USER_SELF' : 'ADMIN_ADDED']
            );
        }
        for (let i = 11; i <= 20; i++) {
            await pool.execute(
                'INSERT INTO participations (user_id, competition_id, city_id, source) VALUES (?, 1, 2, ?)',
                [i, i % 2 === 0 ? 'USER_SELF' : 'ADMIN_ADDED']
            );
        }
        for (let i = 21; i <= 30; i++) {
            await pool.execute(
                'INSERT INTO participations (user_id, competition_id, city_id, source) VALUES (?, 1, 3, ?)',
                [i, i % 2 === 0 ? 'USER_SELF' : 'ADMIN_ADDED']
            );
        }

        // Science Quiz: 20 participants
        for (let i = 1; i <= 20; i++) {
            const cityId = (i % 4) + 1;
            await pool.execute(
                'INSERT INTO participations (user_id, competition_id, city_id, source) VALUES (?, 2, ?, "USER_SELF")',
                [i, cityId]
            );
        }

        // Coding Championship: 15 participants
        for (let i = 5; i <= 19; i++) {
            const cityId = (i % 3) + 1;
            await pool.execute(
                'INSERT INTO participations (user_id, competition_id, city_id, source) VALUES (?, 3, ?, "USER_SELF")',
                [i, cityId]
            );
        }

        // Art Contest (completed): 12 participants
        for (let i = 10; i <= 21; i++) {
            const cityId = (i % 2) + 1;
            await pool.execute(
                'INSERT INTO participations (user_id, competition_id, city_id, source) VALUES (?, 4, ?, "ADMIN_ADDED")',
                [i, cityId]
            );
        }

        console.log('✅ Created participations for all competitions\n');

        // =====================================================
        // SEED ROUNDS (for Math Olympiad)
        // =====================================================
        console.log('🔄 Creating rounds for Math Olympiad...');
        
        // Delhi rounds
        await pool.execute(`
            INSERT INTO rounds (competition_id, city_id, round_number, name, round_date, status, is_finale) VALUES
            (1, 1, 1, 'Preliminary Round', '2026-02-10', 'COMPLETED', FALSE),
            (1, 1, 2, 'Semi-Final', '2026-02-13', 'COMPLETED', FALSE),
            (1, 1, 3, 'City Final', '2026-02-15', 'IN_PROGRESS', TRUE)
        `);
        
        // Mumbai rounds
        await pool.execute(`
            INSERT INTO rounds (competition_id, city_id, round_number, name, round_date, status, is_finale) VALUES
            (1, 2, 1, 'Preliminary Round', '2026-02-11', 'COMPLETED', FALSE),
            (1, 2, 2, 'Semi-Final', '2026-02-14', 'IN_PROGRESS', FALSE),
            (1, 2, 3, 'City Final', '2026-02-16', 'PENDING', TRUE)
        `);
        
        // Bangalore rounds
        await pool.execute(`
            INSERT INTO rounds (competition_id, city_id, round_number, name, round_date, status, is_finale) VALUES
            (1, 3, 1, 'Preliminary Round', '2026-02-12', 'COMPLETED', FALSE),
            (1, 3, 2, 'Semi-Final', '2026-02-15', 'PENDING', FALSE),
            (1, 3, 3, 'City Final', '2026-02-17', 'PENDING', TRUE)
        `);

        console.log('✅ Created 9 rounds (3 per city)\n');

        // =====================================================
        // SEED ROUND PARTICIPATIONS & SCORES
        // =====================================================
        console.log('📊 Adding participants to rounds with scores...');

        // Delhi Round 1 (Preliminary) - all 10 participants
        for (let i = 1; i <= 10; i++) {
            const [result] = await pool.execute(
                'INSERT INTO round_participations (round_id, participation_id, qualified_by) VALUES (1, ?, "AUTOMATIC")',
                [i]
            );
            const rpId = result.insertId;
            const score = Math.floor(Math.random() * 50) + 50; // 50-100
            await pool.execute(
                'INSERT INTO round_scores (round_participation_id, score, rank_in_round) VALUES (?, ?, ?)',
                [rpId, score, 0]
            );
        }

        // Delhi Round 2 (Semi-Final) - top 6 from round 1
        const delhiTop6 = [1, 2, 3, 5, 7, 9]; // participation IDs
        for (let i = 0; i < delhiTop6.length; i++) {
            const [result] = await pool.execute(
                'INSERT INTO round_participations (round_id, participation_id, qualified_by) VALUES (2, ?, "AUTOMATIC")',
                [delhiTop6[i]]
            );
            const rpId = result.insertId;
            const score = Math.floor(Math.random() * 30) + 70; // 70-100
            await pool.execute(
                'INSERT INTO round_scores (round_participation_id, score, rank_in_round) VALUES (?, ?, ?)',
                [rpId, score, i + 1]
            );
        }

        // Delhi Round 3 (Final) - top 3 from round 2
        const delhiTop3 = [1, 3, 5];
        for (let i = 0; i < delhiTop3.length; i++) {
            const [result] = await pool.execute(
                'INSERT INTO round_participations (round_id, participation_id, qualified_by) VALUES (3, ?, "AUTOMATIC")',
                [delhiTop3[i]]
            );
            const rpId = result.insertId;
            // Add scores and mark winners
            const score = 95 - (i * 5);
            await pool.execute(
                'INSERT INTO round_scores (round_participation_id, score, rank_in_round, is_winner, winner_position) VALUES (?, ?, ?, TRUE, ?)',
                [rpId, score, i + 1, i + 1]
            );
        }

        // Mumbai Round 1 - all 10 participants (IDs 11-20)
        for (let i = 11; i <= 20; i++) {
            const [result] = await pool.execute(
                'INSERT INTO round_participations (round_id, participation_id, qualified_by) VALUES (4, ?, "AUTOMATIC")',
                [i]
            );
            const rpId = result.insertId;
            const score = Math.floor(Math.random() * 50) + 50;
            await pool.execute(
                'INSERT INTO round_scores (round_participation_id, score, rank_in_round) VALUES (?, ?, ?)',
                [rpId, score, 0]
            );
        }

        // Mumbai Round 2 - top 5 from round 1
        const mumbaiTop5 = [11, 12, 14, 16, 18];
        for (let i = 0; i < mumbaiTop5.length; i++) {
            const [result] = await pool.execute(
                'INSERT INTO round_participations (round_id, participation_id, qualified_by) VALUES (5, ?, "AUTOMATIC")',
                [mumbaiTop5[i]]
            );
            const rpId = result.insertId;
            const score = Math.floor(Math.random() * 25) + 75;
            await pool.execute(
                'INSERT INTO round_scores (round_participation_id, score, rank_in_round) VALUES (?, ?, ?)',
                [rpId, score, i + 1]
            );
        }

        // Bangalore Round 1 - all 10 participants (IDs 21-30)
        for (let i = 21; i <= 30; i++) {
            const [result] = await pool.execute(
                'INSERT INTO round_participations (round_id, participation_id, qualified_by) VALUES (7, ?, "AUTOMATIC")',
                [i]
            );
            const rpId = result.insertId;
            const score = Math.floor(Math.random() * 50) + 50;
            await pool.execute(
                'INSERT INTO round_scores (round_participation_id, score, rank_in_round) VALUES (?, ?, ?)',
                [rpId, score, 0]
            );
        }

        console.log('✅ Added round participations with scores\n');

        // =====================================================
        // SEED RESULTS (for completed Art Contest)
        // =====================================================
        console.log('🏅 Creating results for completed competition...');
        
        // Art Contest (competition_id = 4) - participation IDs start from where we inserted
        const [artParticipations] = await pool.execute(
            'SELECT id FROM participations WHERE competition_id = 4 ORDER BY id'
        );
        
        for (let i = 0; i < artParticipations.length; i++) {
            const pId = artParticipations[i].id;
            let status = 'PARTICIPATED';
            let position = null;
            
            if (i === 0) { status = 'WINNER'; position = 1; }
            else if (i === 1) { status = 'WINNER'; position = 2; }
            else if (i === 2) { status = 'WINNER'; position = 3; }
            
            await pool.execute(
                'INSERT INTO results (participation_id, result_status, position, locked) VALUES (?, ?, ?, TRUE)',
                [pId, status, position]
            );
        }
        console.log('✅ Created results for Art Contest\n');

        // =====================================================
        // Update round scores with proper ranks
        // =====================================================
        console.log('📈 Updating ranks in round scores...');
        
        // Get all rounds and update ranks
        const [rounds] = await pool.execute('SELECT id FROM rounds');
        for (const round of rounds) {
            await pool.execute(`
                UPDATE round_scores rs
                JOIN round_participations rp ON rs.round_participation_id = rp.id
                SET rs.rank_in_round = (
                    SELECT COUNT(*) + 1 
                    FROM (SELECT rs2.score, rs2.round_participation_id 
                          FROM round_scores rs2 
                          JOIN round_participations rp2 ON rs2.round_participation_id = rp2.id
                          WHERE rp2.round_id = ?) as t
                    WHERE t.score > rs.score
                )
                WHERE rp.round_id = ?
            `, [round.id, round.id]);
        }
        console.log('✅ Ranks updated\n');

        // =====================================================
        // SUMMARY
        // =====================================================
        console.log('═══════════════════════════════════════════════════════');
        console.log('                    SEEDING COMPLETE!                   ');
        console.log('═══════════════════════════════════════════════════════\n');
        
        console.log('📋 TEST ACCOUNTS:\n');
        console.log('   ADMIN PANEL (http://localhost:5173):');
        console.log('   ├─ Admin:       admin@test.com / admin123');
        console.log('   ├─ Coordinator: delhi.coord@test.com / coord123');
        console.log('   ├─ Coordinator: mumbai.coord@test.com / coord123');
        console.log('   └─ Coordinator: bangalore.coord@test.com / coord123\n');
        
        console.log('   USER PANEL (http://localhost:5174):');
        console.log('   ├─ User 1:  aarav.sharma1@test.com / user123  (MI000001)');
        console.log('   ├─ User 2:  vivaan.patel2@test.com / user123  (MI000002)');
        console.log('   ├─ User 11: ananya.sharma11@test.com / user123 (MI000011)');
        console.log('   └─ User 21: rohan.sharma21@test.com / user123 (MI000021)\n');
        
        console.log('📊 DATA CREATED:');
        console.log('   ├─ 4 Admins (1 admin + 3 coordinators)');
        console.log('   ├─ 6 Cities');
        console.log('   ├─ 50 Users with MI IDs');
        console.log('   ├─ 5 Competitions (various statuses)');
        console.log('   ├─ 15 Competition-City links');
        console.log('   ├─ 77 Participations');
        console.log('   ├─ 9 Rounds (for Math Olympiad)');
        console.log('   ├─ Round participations with scores');
        console.log('   └─ Results for completed competition\n');
        
        console.log('🎯 TESTING SCENARIOS:');
        console.log('   ├─ Math Olympiad: Active with rounds (Delhi has all 3 rounds)');
        console.log('   ├─ Science Quiz: Active, no rounds yet');
        console.log('   ├─ Coding Championship: Registration open');
        console.log('   ├─ Art Contest: Completed with results');
        console.log('   └─ Debate Competition: Draft status\n');

        await pool.end();
        console.log('✅ Database connection closed');
        
    } catch (error) {
        console.error('❌ Error during seeding:', error);
        await pool.end();
        process.exit(1);
    }
}

seed();
