const jwt = require('jsonwebtoken');
const { getPool } = require('../config/database');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }

        const token = authHeader.split(' ')[1];

        try {
            // Use ADMIN JWT SECRET - completely different from user secret
            const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);

            // Verify admin still exists and is active
            const db = getPool();
            const [admins] = await db.execute(
                'SELECT id, full_name, email, role, status FROM admins WHERE id = ?',
                [decoded.adminId]
            );

            if (admins.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Admin not found'
                });
            }

            if (admins[0].status !== 'ACTIVE') {
                return res.status(403).json({
                    success: false,
                    message: 'Account suspended'
                });
            }

            req.admin = admins[0];
            next();
        } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Token expired',
                    code: 'TOKEN_EXPIRED'
                });
            }
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
    } catch (error) {
        console.error('Admin auth middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

module.exports = authMiddleware;
