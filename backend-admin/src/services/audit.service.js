const { getPool } = require('../config/database');

class AuditService {
    async log(adminId, action, entityType, entityId, details, ipAddress) {
        try {
            const db = getPool();
            await db.execute(
                `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
                [adminId, action, entityType, entityId, JSON.stringify(details), ipAddress]
            );
        } catch (error) {
            console.error('Audit log error:', error);
            // Don't throw - audit logging should not break the main operation
        }
    }

    async getLogs(filters = {}) {
        const db = getPool();
        let query = `
      SELECT 
        al.id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.details,
        al.ip_address,
        al.created_at,
        a.full_name as admin_name,
        a.email as admin_email,
        a.role as admin_role
      FROM audit_logs al
      JOIN admins a ON al.admin_id = a.id
      WHERE 1=1
    `;
        const params = [];

        if (filters.admin_id) {
            query += ' AND al.admin_id = ?';
            params.push(filters.admin_id);
        }

        if (filters.action) {
            query += ' AND al.action = ?';
            params.push(filters.action);
        }

        if (filters.entity_type) {
            query += ' AND al.entity_type = ?';
            params.push(filters.entity_type);
        }

        if (filters.from_date) {
            query += ' AND al.created_at >= ?';
            params.push(filters.from_date);
        }

        if (filters.to_date) {
            query += ' AND al.created_at <= ?';
            params.push(filters.to_date);
        }

        query += ' ORDER BY al.created_at DESC LIMIT 500';

        const [logs] = await db.execute(query, params);
        return logs;
    }
}

module.exports = new AuditService();
