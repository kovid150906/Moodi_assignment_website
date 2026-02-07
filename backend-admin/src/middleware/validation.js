const Joi = require('joi');

// Validation schemas for admin operations
const schemas = {
    login: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    }),

    createUser: Joi.object({
        full_name: Joi.string().min(1).max(255).required(),
        mi_id: Joi.string().min(1).max(50).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(8).max(128)
            .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
            .required()
    }),

    createAdmin: Joi.object({
        full_name: Joi.string().min(1).max(255).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(8).max(128)
            .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
            .required(),
        role: Joi.string().valid('ADMIN', 'COORDINATOR').required()
    }),

    // Competition - cities are added separately after creation
    createCompetition: Joi.object({
        name: Joi.string().min(1).max(255).required(),
        description: Joi.string().allow('').optional()
    }),

    // Add city to competition
    addCityToCompetition: Joi.object({
        city_id: Joi.number().integer().positive().required(),
        event_date: Joi.date().optional().allow(null)
    }),

    // Create new city in the system
    createCity: Joi.object({
        name: Joi.string().min(2).max(255).required()
    }),

    updateCompetition: Joi.object({
        name: Joi.string().min(2).max(255).optional(),
        description: Joi.string().allow('').optional(),
        registration_open: Joi.boolean().optional(),
        status: Joi.string().valid('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED').optional()
    }),

    addParticipant: Joi.object({
        user_id: Joi.number().integer().positive().required(),
        city_id: Joi.number().integer().positive().required()
    }),

    assignResult: Joi.object({
        participation_id: Joi.number().integer().positive().required(),
        result_status: Joi.string().valid('PARTICIPATED', 'WINNER').required(),
        position: Joi.number().integer().min(1).when('result_status', {
            is: 'WINNER',
            then: Joi.required(),
            otherwise: Joi.optional()
        })
    }),

    createTemplate: Joi.object({
        name: Joi.string().min(2).max(255).required(),
        is_dynamic: Joi.boolean().default(false),
        page_width: Joi.number().integer().min(100).default(842),
        page_height: Joi.number().integer().min(100).default(595),
        orientation: Joi.string().valid('LANDSCAPE', 'PORTRAIT').default('LANDSCAPE')
    }),

    templateField: Joi.object({
        field_type: Joi.string().valid('NAME', 'RANK', 'SCORE', 'COMPETITION', 'ROUND', 'DATE', 'CITY', 'RESULT', 'POSITION', 'MI_ID', 'BENEFACTORS').required(),
        x_coordinate: Joi.number().integer().min(0).required(),
        y_coordinate: Joi.number().integer().min(0).required(),
        font_size: Joi.number().integer().min(8).max(120).default(24),
        font_family: Joi.string().default('Helvetica'),
        font_color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#000000'),
        alignment: Joi.string().valid('left', 'center', 'right').default('center')
    }),

    generateCertificates: Joi.object({
        competition_id: Joi.number().integer().positive().required(),
        template_id: Joi.number().integer().positive().required(),
        participation_ids: Joi.array().items(Joi.number().integer().positive()).min(1).required()
    })
};

// Validation middleware factory
const validate = (schemaName) => {
    return (req, res, next) => {
        const schema = schemas[schemaName];
        if (!schema) {
            return res.status(500).json({
                success: false,
                message: 'Validation schema not found'
            });
        }

        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        req.validatedBody = value;
        next();
    };
};

module.exports = { validate, schemas };
