//middleware/setupMiddleware.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const logger = require('./logger');
const errorHandler = require('./errorHandler');

const setupMiddleware = (app) => {
    // security headers
    app.use(helmet());

    // core middleware
    app.use(cors({
        origin: process.env.NODE_ENV === 'production'
            ? process.env.FRONTEND_URL
            : "http://localhost:5173",
        credentials: true,
    })
    );

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // static files middleware
    app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

    // request logger
    app.use(logger);

    // error handler (always last)
    app.use(errorHandler);
};

module.exports = setupMiddleware;
