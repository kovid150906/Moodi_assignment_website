const { getPool } = require('../config/database');
const path = require('path');

class CertificateService {
  /**
   * Get all released certificates for a user
   */
  async getUserCertificates(userId) {
    const db = getPool();
    const [certificates] = await db.execute(`
      SELECT 
        cert.id,
        cert.certificate_number,
        cert.file_path,
        cert.status,
        cert.released_at,
        cert.created_at,
        c.name as competition_name,
        c.description as competition_description,
        ci.name as city_name,
        cc.event_date,
        r.result_status,
        r.position,
        t.name as template_name
      FROM certificates cert
      JOIN participations p ON cert.participation_id = p.id
      JOIN competitions c ON p.competition_id = c.id
      JOIN cities ci ON p.city_id = ci.id
      LEFT JOIN competition_cities cc ON cc.competition_id = c.id AND cc.city_id = ci.id
      LEFT JOIN results r ON r.participation_id = p.id
      LEFT JOIN certificate_templates t ON cert.template_id = t.id
      WHERE p.user_id = ?
        AND cert.status = 'RELEASED'
      ORDER BY cert.released_at DESC
    `, [userId]);

    return certificates;
  }

  /**
   * Get certificate by ID (only if owned by user and released)
   */
  async getCertificateById(certificateId, userId) {
    const db = getPool();
    const [certificates] = await db.execute(`
      SELECT 
        cert.id,
        cert.certificate_number,
        cert.file_path,
        cert.status,
        cert.released_at,
        cert.created_at,
        c.name as competition_name,
        c.description as competition_description,
        ci.name as city_name,
        cc.event_date,
        r.result_status,
        r.position,
        t.name as template_name,
        u.full_name as user_name
      FROM certificates cert
      JOIN participations p ON cert.participation_id = p.id
      JOIN competitions c ON p.competition_id = c.id
      JOIN cities ci ON p.city_id = ci.id
      JOIN users u ON p.user_id = u.id
      LEFT JOIN competition_cities cc ON cc.competition_id = c.id AND cc.city_id = ci.id
      LEFT JOIN results r ON r.participation_id = p.id
      LEFT JOIN certificate_templates t ON cert.template_id = t.id
      WHERE cert.id = ?
        AND p.user_id = ?
        AND cert.status = 'RELEASED'
    `, [certificateId, userId]);

    if (certificates.length === 0) {
      return null;
    }

    return certificates[0];
  }

  /**
   * Get certificate for download (security check + return file path)
   */
  async getCertificateForDownload(certificateId, userId) {
    const certificate = await this.getCertificateById(certificateId, userId);

    if (!certificate) {
      throw new Error('Certificate not found or not accessible');
    }

    if (!certificate.file_path) {
      throw new Error('Certificate file not available');
    }

    return certificate;
  }

  /**
   * Get certificate statistics for a user
   */
  async getUserCertificateStats(userId) {
    const db = getPool();

    const [stats] = await db.execute(`
      SELECT 
        COUNT(*) as total_certificates,
        SUM(CASE WHEN r.result_status = 'WINNER' THEN 1 ELSE 0 END) as winner_certificates,
        SUM(CASE WHEN r.result_status = 'PARTICIPATED' THEN 1 ELSE 0 END) as participation_certificates,
        COUNT(DISTINCT p.competition_id) as competitions_count,
        COUNT(DISTINCT p.city_id) as cities_count
      FROM certificates cert
      JOIN participations p ON cert.participation_id = p.id
      LEFT JOIN results r ON r.participation_id = p.id
      WHERE p.user_id = ?
        AND cert.status = 'RELEASED'
    `, [userId]);

    return stats[0];
  }

  /**
   * Get certificates grouped by competition
   */
  async getUserCertificatesByCompetition(userId) {
    const db = getPool();

    const [competitions] = await db.execute(`
      SELECT DISTINCT
        c.id as competition_id,
        c.name as competition_name,
        c.description,
        COUNT(DISTINCT cert.id) as certificate_count
      FROM competitions c
      JOIN participations p ON c.id = p.competition_id
      JOIN certificates cert ON p.id = cert.participation_id
      WHERE p.user_id = ?
        AND cert.status = 'RELEASED'
      GROUP BY c.id, c.name, c.description
      ORDER BY c.name
    `, [userId]);

    // Get certificates for each competition
    for (const competition of competitions) {
      const [certificates] = await db.execute(`
        SELECT 
          cert.id,
          cert.certificate_number,
          cert.file_path,
          cert.released_at,
          ci.name as city_name,
          cc.event_date,
          r.result_status,
          r.position
        FROM certificates cert
        JOIN participations p ON cert.participation_id = p.id
        JOIN cities ci ON p.city_id = ci.id
        LEFT JOIN competition_cities cc ON cc.competition_id = p.competition_id AND cc.city_id = ci.id
        LEFT JOIN results r ON r.participation_id = p.id
        WHERE p.user_id = ?
          AND p.competition_id = ?
          AND cert.status = 'RELEASED'
        ORDER BY cert.released_at DESC
      `, [userId, competition.competition_id]);

      competition.certificates = certificates;
    }

    return competitions;
  }

  /**
   * Get certificates grouped by city
   */
  async getUserCertificatesByCity(userId) {
    const db = getPool();

    const [cities] = await db.execute(`
      SELECT DISTINCT
        ci.id as city_id,
        ci.name as city_name,
        COUNT(DISTINCT cert.id) as certificate_count
      FROM cities ci
      JOIN participations p ON ci.id = p.city_id
      JOIN certificates cert ON p.id = cert.participation_id
      WHERE p.user_id = ?
        AND cert.status = 'RELEASED'
      GROUP BY ci.id, ci.name
      ORDER BY ci.name
    `, [userId]);

    // Get certificates for each city
    for (const city of cities) {
      const [certificates] = await db.execute(`
        SELECT 
          cert.id,
          cert.certificate_number,
          cert.file_path,
          cert.released_at,
          c.name as competition_name,
          cc.event_date,
          r.result_status,
          r.position
        FROM certificates cert
        JOIN participations p ON cert.participation_id = p.id
        JOIN competitions c ON p.competition_id = c.id
        LEFT JOIN competition_cities cc ON cc.competition_id = c.id AND cc.city_id = p.city_id
        LEFT JOIN results r ON r.participation_id = p.id
        WHERE p.user_id = ?
          AND p.city_id = ?
          AND cert.status = 'RELEASED'
        ORDER BY cert.released_at DESC
      `, [userId, city.city_id]);

      city.certificates = certificates;
    }

    return cities;
  }

  /**
   * Check if user has access to a certificate
   */
  async userHasAccessToCertificate(certificateId, userId) {
    const db = getPool();

    const [results] = await db.execute(`
      SELECT 1
      FROM certificates cert
      JOIN participations p ON cert.participation_id = p.id
      WHERE cert.id = ?
        AND p.user_id = ?
        AND cert.status = 'RELEASED'
    `, [certificateId, userId]);

    return results.length > 0;
  }
}

module.exports = new CertificateService();
