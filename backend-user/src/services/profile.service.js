const bcrypt = require("bcryptjs");
const { getPool } = require("../config/database");

class ProfileService {
  // Validate password strength
  validatePassword(password) {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
  }

  // Get user profile
  async getProfile(userId) {
    const db = getPool();
    const [users] = await db.execute(
      "SELECT id, mi_id, full_name, email, status, created_at FROM users WHERE id = ?",
      [userId]
    );

    if (users.length === 0) {
      throw new Error("User not found");
    }

    return users[0];
  }

  // Get user stats
  async getStats(userId) {
    const db = getPool();
    const [stats] = await db.execute(
      `
            SELECT 
                (SELECT COUNT(*) FROM participations WHERE user_id = ?) as total_participations,
                (SELECT COUNT(*) FROM results r 
                 JOIN participations p ON r.participation_id = p.id 
                 WHERE p.user_id = ? AND r.result_status = 'WINNER') as wins,
                (SELECT COUNT(*) FROM results r 
                 JOIN participations p ON r.participation_id = p.id 
                 WHERE p.user_id = ? AND r.position = 1) as first_places,
                (SELECT COUNT(*) FROM certificates c 
                 JOIN participations p ON c.participation_id = p.id 
                 WHERE p.user_id = ? AND c.status = 'RELEASED') as certificates_earned
        `,
      [userId, userId, userId, userId]
    );

    return stats[0];
  }

  // Update profile
  async updateProfile(userId, data) {
    const db = getPool();
    const fields = [];
    const params = [];

    if (data.full_name) {
      fields.push("full_name = ?");
      params.push(data.full_name);
    }

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    params.push(userId);

    await db.execute(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    return this.getProfile(userId);
  }

  // Change password
  async changePassword(userId, currentPassword, newPassword) {
    const db = getPool();

    // Get current password hash
    const [users] = await db.execute(
      "SELECT password_hash FROM users WHERE id = ?",
      [userId]
    );

    if (users.length === 0) {
      throw new Error("User not found");
    }

    // Verify current password
    const validPassword = await bcrypt.compare(
      currentPassword,
      users[0].password_hash
    );
    if (!validPassword) {
      throw new Error("Current password is incorrect");
    }

    // Validate new password strength
    this.validatePassword(newPassword);

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.execute("UPDATE users SET password_hash = ? WHERE id = ?", [
      newPasswordHash,
      userId,
    ]);

    return { success: true };
  }

  // Get participation history (detailed)
  async getParticipationHistory(userId) {
    const db = getPool();
    const [participations] = await db.execute(
      `
            SELECT 
                p.id,
                p.registered_at,
                p.source,
                c.id as competition_id,
                c.name as competition_name,
                c.status as competition_status,
                ci.id as city_id,
                ci.name as city_name,
                cc.event_date,
                r.result_status,
                r.position,
                cert.id as certificate_id,
                cert.released as certificate_released
            FROM participations p
            JOIN competitions c ON p.competition_id = c.id
            JOIN cities ci ON p.city_id = ci.id
            LEFT JOIN competition_cities cc ON cc.competition_id = c.id AND cc.city_id = ci.id
            LEFT JOIN results r ON r.participation_id = p.id
            LEFT JOIN certificates cert ON cert.participation_id = p.id
            WHERE p.user_id = ?
            ORDER BY p.registered_at DESC
        `,
      [userId]
    );

    return participations;
  }
}

module.exports = new ProfileService();
