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
    NEWS_MEDIA_ROOT: Joi.string().default('./storage/media/news'),
    NEWS_MEDIA_PENDING_TTL_HOURS: Joi.number().positive().default(24),
    NEWS_MEDIA_REMOTE_IMPORT_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
    NEWS_MEDIA_IMPORT_MAX_BYTES: Joi.number()
        .integer()
        .positive()
        .max(10 * 1024 * 1024)
        .default(10 * 1024 * 1024),
    NEWS_MEDIA_IMPORT_TIMEOUT_MS: Joi.number().integer().positive().max(60000).default(15000),
    NEWS_MEDIA_IMPORT_MAX_REDIRECTS: Joi.number().integer().min(0).max(10).default(3),
    NEWS_MEDIA_IMPORT_TEST_SOURCE_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
    NEWS_MEDIA_IMPORT_TEST_HOST: Joi.string().hostname().allow('').optional(),
    NEWS_MEDIA_IMPORT_TEST_PORT: Joi.number().port().optional(),
    NEWS_MEDIA_IMPORT_TEST_IP: Joi.string().ip().optional(),
    FRONTEND_URL: Joi.string().uri().required(),
    SUPER_ADMIN_EMAIL: Joi.string().email().allow('').optional(),
    SUPER_ADMIN_PASSWORD: Joi.string().min(8).allow('').optional(),
    ADMIN_AUTH_RATE_LIMIT_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
    ADMIN_AUTH_RATE_LIMIT_WINDOW_SECONDS: Joi.number().integer().positive().default(60),
    ADMIN_AUTH_RATE_LIMIT_MAX_ATTEMPTS: Joi.number().integer().positive().default(3),
    ADMIN_AUTH_RATE_LIMIT_BLOCK_SECONDS: Joi.number().integer().positive().default(60),
    ADMIN_AUTH_TRUST_PROXY_HOPS: Joi.number().integer().min(0).default(0),
})
