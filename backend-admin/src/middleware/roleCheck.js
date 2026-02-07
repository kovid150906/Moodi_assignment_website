// Role-based access control middleware
// Enforces ADMIN > COORDINATOR hierarchy

const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!allowedRoles.includes(req.admin.role)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
        }

        next();
    };
};

// Shorthand middleware for common role checks
const adminOnly = requireRole('ADMIN');
const anyAdmin = requireRole('ADMIN', 'COORDINATOR');

module.exports = {
    requireRole,
    adminOnly,
    anyAdmin
};
