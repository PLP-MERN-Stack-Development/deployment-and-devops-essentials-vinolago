// middleware/monitoring.js - Application monitoring and metrics

const responseTime = require('response-time');

// Response time middleware
const responseTimeMiddleware = responseTime((req, res, time) => {
  // Log response time for monitoring
  if (time > 1000) { // Log slow requests (> 1 second)
    console.log(`Slow request: ${req.method} ${req.url} took ${time}ms`);
  }
});

// Request metrics middleware
const requestMetricsMiddleware = (req, res, next) => {
  const start = Date.now();

  // Override res.end to capture response
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;

    // Basic metrics logging
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);

    // Call original end
    originalEnd.apply(this, args);
  };

  next();
};

// Memory usage monitoring
const logMemoryUsage = () => {
  const memUsage = process.memoryUsage();
  console.log(`Memory Usage: RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB/${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
};

// Log memory usage every 5 minutes in production
if (process.env.NODE_ENV === 'production') {
  setInterval(logMemoryUsage, 5 * 60 * 1000);
}

module.exports = {
  responseTimeMiddleware,
  requestMetricsMiddleware,
  logMemoryUsage
};