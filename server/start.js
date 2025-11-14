// start.js - Connects to MongoDB and starts the server
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { connectDB } = require('./config/db');
const app = require('./server');

// Set NODE_ENV to production if not already set (for production deployments)
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

dotenv.config();

const PORT = process.env.PORT || 5000;

connectDB();

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});
