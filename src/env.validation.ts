import * as Joi from 'joi'

export const validationSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'test', 'production').required(),
    PORT: Joi.number().port().required(),
    DATABASE_URL: Joi.string()
        .uri({ scheme: ['postgres', 'postgresql'] })
        .required(),
    DATABASE_HOST: Joi.string().hostname().required(),
    DATABASE_PORT: Joi.number().port().required(),
    DATABASE_PORT_OUT: Joi.number().port().required(),
    DATABASE_USER: Joi.string().required(),
    DATABASE_PASSWORD: Joi.string().required(),
    DATABASE_DB: Joi.string().required(),
    JWT_SECRET: Joi.string().min(8).required(),
    JWT_EXPIRES: Joi.string()
        .pattern(/^\d+[smhdwy]$/)
        .required(),
    SERVICE_TOKEN_AUTH: Joi.string().min(8).required(),
    UPLOADS_DIR: Joi.string().required(),
    PUBLIC_UPLOADS_URL: Joi.string().required(),
    DOCUMENT_STORAGE_ROOT: Joi.string().required(),
    DOCUMENT_TEMP_ROOT: Joi.string().required(),
    DOCUMENT_MAX_FILE_SIZE_MB: Joi.number().integer().min(1).max(1024).required(),
    FRONTEND_URL: Joi.string().uri().required(),
    SUPER_ADMIN_EMAIL: Joi.string().email().allow('').optional(),
    SUPER_ADMIN_PASSWORD: Joi.string().min(8).allow('').optional(),
})
