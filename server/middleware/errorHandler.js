//middleware/errorHandler.js

const winston = require('winston');

// Create winston logger for errors
const errorLogger = winston.createLogger({
    level: 'error',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'mern-blog-api' },
    transports: [
        new winston.transports.File({ filename: 'logs/errors.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ],
});

const errorHandler = (err, req, res, next) => {
    // Log the error
    errorLogger.error(err.message, {
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorResponse = {
        success: false,
        error: isDevelopment ? err.message : 'Server Error'
    };

    // Add stack trace in development
    if (isDevelopment && err.stack) {
        errorResponse.stack = err.stack;
    }

    res.status(err.statusCode || 500).json(errorResponse);
};

module.exports = errorHandler;