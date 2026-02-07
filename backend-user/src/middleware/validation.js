const Joi = require('joi');

// Validation schemas
const schemas = {
    register: Joi.object({
        full_name: Joi.string().min(2).max(255).required()
            .messages({
                'string.min': 'Name must be at least 2 characters',
                'string.max': 'Name cannot exceed 255 characters',
                'any.required': 'Full name is required'
            }),
        mi_id: Joi.string().required()
            .messages({
                'any.required': 'MI ID is required'
            }),
        email: Joi.string().email().required()
            .messages({
                'string.email': 'Please provide a valid email',
                'any.required': 'Email is required'
            }),
        password: Joi.string().min(8).max(128)
            .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
            .required()
            .messages({
                'string.min': 'Password must be at least 8 characters',
                'string.pattern.base': 'Password must contain uppercase, lowercase, and number',
                'any.required': 'Password is required'
            })
    }),

    login: Joi.object({
        email: Joi.string().email().required()
            .messages({
                'string.email': 'Please provide a valid email',
                'any.required': 'Email is required'
            }),
        password: Joi.string().required()
            .messages({
                'any.required': 'Password is required'
            })
    }),

    competitionRegister: Joi.object({
        city_id: Joi.number().integer().positive().required()
            .messages({
                'number.base': 'City ID must be a number',
                'any.required': 'City ID is required'
            })
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
