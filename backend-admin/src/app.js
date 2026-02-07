require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDatabase } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const adminRoutes = require('./routes/admin.routes');
const competitionRoutes = require('./routes/competition.routes');
const resultRoutes = require('./routes/result.routes');
const certificateRoutes = require('./routes/certificate.routes');
const roundRoutes = require('./routes/round.routes');

const app = express();
const PORT = process.env.PORT || 3002;

// Security middleware - Configure helmet to allow cross-origin resources
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            frameAncestors: ["'self'", "http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
            imgSrc: ["'self'", "data:", "blob:"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
        }
    }
}));

app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        process.env.CORS_ORIGIN
    ].filter(Boolean),
    credentials: true
}));

// Rate limiting - high limits for 10k+ concurrent users
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10000, // 10k requests per minute per IP
    message: {
        success: false,
        message: 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// Auth rate limiting (still somewhat strict to prevent brute force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500, // 500 auth requests per 15 minutes
    message: {
        success: false,
        message: 'Too many authentication attempts'
    }
});
app.use('/api/auth/', authLimiter);

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS headers for static files
app.use('/generated', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
});

app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
});

// Static files for generated certificates (admin preview)
app.use('/generated', express.static(path.join(__dirname, '../generated')));

// Static files for uploaded templates (PDF, SVG previews)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        service: 'Certificate Distribution System - Admin Backend',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            api: '/api',
            auth: '/api/auth',
            users: '/api/users',
            admins: '/api/admins',
            competitions: '/api/competitions',
            results: '/api/results',
            certificates: '/api/certificates',
            rounds: '/api/rounds'
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'backend-admin' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/competitions', competitionRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/certificates', certificateRoutes);  // Changed from /api/templates to /api/certificates
app.use('/api/rounds', roundRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);

    // Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            message: 'File too large'
        });
    }

    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// Start server with database initialization
const startServer = async () => {
    try {
        await initDatabase();
        app.listen(PORT, () => {
            console.log(`🔐 Admin Backend running on http://localhost:${PORT}`);
            console.log(`📚 API available at http://localhost:${PORT}/api`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
};

startServer();

module.exports = app;
