// server.js - Main server file for the MERN blog application

// Initialize Sentry first
const { initSentry, requestHandler, errorHandler } = require('./middleware/sentry');
initSentry();

const express = require('express');
const setupMiddleware = require('./middleware/setupMiddleware');

// Import routes
const postRoutes = require('./routes/posts');
const categoryRoutes = require('./routes/categories');
const authRoutes = require('./routes/auth.js');

const app = express();

// Apply Sentry middleware before other middleware
app.use(requestHandler());

// Apply other middleware
setupMiddleware(app);

// Import health routes
const healthRoutes = require('./routes/health');

// API routes
app.use('/api/posts', postRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/auth', authRoutes);
app.use('/', healthRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('MERN Blog API is running');
});

// Error handling middleware
app.use(errorHandler());

// Regular error handler for non-Sentry errors
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Server Error',
  });
});

module.exports = app;