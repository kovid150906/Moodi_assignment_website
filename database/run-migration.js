const mysql = require('mysql2/promise');

async function runMigration() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'kb@8370007067',
        database: 'certificate_system',
        multipleStatements: true
    });

    console.log('🔄 Running database migration...');

    try {
        // Add missing columns to certificate_templates
        console.log('Adding columns to certificate_templates...');
        await connection.execute(`
            ALTER TABLE certificate_templates 
            ADD COLUMN description TEXT AFTER name
        `).catch(() => console.log('  - description column already exists'));

        await connection.execute(`
            ALTER TABLE certificate_templates 
            ADD COLUMN file_type ENUM('PDF', 'PNG', 'JPG', 'SVG') DEFAULT 'PDF' AFTER file_path
        `).catch(() => console.log('  - file_type column already exists'));

        await connection.execute(`
            ALTER TABLE certificate_templates 
            ADD COLUMN status ENUM('ACTIVE', 'ARCHIVED') DEFAULT 'ACTIVE' AFTER orientation
        `).catch(() => console.log('  - status column already exists'));

        await connection.execute(`
            ALTER TABLE certificate_templates 
            ADD COLUMN created_by_admin_id INT DEFAULT NULL AFTER status
        `).catch(() => console.log('  - created_by_admin_id column already exists'));

        // Add indexes
        await connection.execute(`
            ALTER TABLE certificate_templates 
            ADD INDEX idx_ct_status (status)
        `).catch(() => console.log('  - idx_ct_status index already exists'));

        await connection.execute(`
            ALTER TABLE certificate_templates 
            ADD INDEX idx_ct_competition (competition_id)
        `).catch(() => console.log('  - idx_ct_competition index already exists'));

        // Add foreign key
        await connection.execute(`
            ALTER TABLE certificate_templates 
            ADD CONSTRAINT fk_template_admin 
            FOREIGN KEY (created_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL
        `).catch(() => console.log('  - fk_template_admin foreign key already exists'));

        // Add missing columns to certificate_template_fields
        console.log('\\nAdding columns to certificate_template_fields...');
        
        await connection.execute(`
            ALTER TABLE certificate_template_fields
            ADD COLUMN field_label VARCHAR(100) AFTER field_type
        `).catch(() => console.log('  - field_label column already exists'));

        await connection.execute(`
            ALTER TABLE certificate_template_fields
            ADD COLUMN x_position INT NOT NULL DEFAULT 0 AFTER field_label
        `).catch(() => console.log('  - x_position column already exists'));

        await connection.execute(`
            ALTER TABLE certificate_template_fields
            ADD COLUMN y_position INT NOT NULL DEFAULT 0 AFTER x_position
        `).catch(() => console.log('  - y_position column already exists'));

        await connection.execute(`
            ALTER TABLE certificate_template_fields
            ADD COLUMN width INT DEFAULT 400 AFTER y_position
        `).catch(() => console.log('  - width column already exists'));

        await connection.execute(`
            ALTER TABLE certificate_template_fields
            ADD COLUMN height INT DEFAULT 50 AFTER width
        `).catch(() => console.log('  - height column already exists'));

        await connection.execute(`
            ALTER TABLE certificate_template_fields
            ADD COLUMN font_weight ENUM('NORMAL', 'BOLD', 'LIGHT') DEFAULT 'NORMAL' AFTER font_family
        `).catch(() => console.log('  - font_weight column already exists'));

        await connection.execute(`
            ALTER TABLE certificate_template_fields
            ADD COLUMN text_align ENUM('LEFT', 'CENTER', 'RIGHT') DEFAULT 'CENTER' AFTER font_color
        `).catch(() => console.log('  - text_align column already exists'));

        await connection.execute(`
            ALTER TABLE certificate_template_fields
            ADD COLUMN line_height DECIMAL(3,2) DEFAULT 1.2 AFTER text_align
        `).catch(() => console.log('  - line_height column already exists'));

        await connection.execute(`
            ALTER TABLE certificate_template_fields
            ADD COLUMN text_transform ENUM('NONE', 'UPPERCASE', 'LOWERCASE', 'CAPITALIZE') DEFAULT 'NONE' AFTER line_height
        `).catch(() => console.log('  - text_transform column already exists'));

        await connection.execute(`
            ALTER TABLE certificate_template_fields
            ADD COLUMN date_format VARCHAR(50) DEFAULT 'DD MMM YYYY' AFTER text_transform
        `).catch(() => console.log('  - date_format column already exists'));

        // Add missing columns to certificates
        console.log('\\nAdding columns to certificates...');
        
        await connection.execute(`
            ALTER TABLE certificates
            ADD COLUMN certificate_number VARCHAR(100) UNIQUE AFTER template_id
        `).catch(() => console.log('  - certificate_number column already exists'));

        await connection.execute(`
            ALTER TABLE certificates
            ADD COLUMN status ENUM('DRAFT', 'GENERATED', 'RELEASED', 'REVOKED') DEFAULT 'DRAFT' AFTER file_path
        `).catch(() => console.log('  - status column already exists'));

        await connection.execute(`
            ALTER TABLE certificates
            ADD COLUMN generated_at TIMESTAMP NULL AFTER status
        `).catch(() => console.log('  - generated_at column already exists'));

        await connection.execute(`
            ALTER TABLE certificates
            ADD COLUMN released_at TIMESTAMP NULL AFTER generated_at
        `).catch(() => console.log('  - released_at column already exists'));

        await connection.execute(`
            ALTER TABLE certificates
            ADD COLUMN revoked_at TIMESTAMP NULL AFTER released_at
        `).catch(() => console.log('  - revoked_at column already exists'));

        await connection.execute(`
            ALTER TABLE certificates
            ADD COLUMN revoke_reason TEXT AFTER revoked_at
        `).catch(() => console.log('  - revoke_reason column already exists'));

        await connection.execute(`
            ALTER TABLE certificates
            ADD COLUMN generated_by_admin_id INT DEFAULT NULL AFTER revoke_reason
        `).catch(() => console.log('  - generated_by_admin_id column already exists'));

        await connection.execute(`
            ALTER TABLE certificates
            ADD COLUMN released_by_admin_id INT DEFAULT NULL AFTER generated_by_admin_id
        `).catch(() => console.log('  - released_by_admin_id column already exists'));

        // Modify field_type to include CUSTOM
        console.log('\\nUpdating field_type enum...');
        await connection.execute(`
            ALTER TABLE certificate_template_fields 
            MODIFY COLUMN field_type ENUM('NAME', 'COMPETITION', 'CITY', 'DATE', 'RESULT', 'POSITION', 'MI_ID', 'CUSTOM') NOT NULL
        `);

        console.log('\\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await connection.end();
    }
}

runMigration().catch(console.error);
