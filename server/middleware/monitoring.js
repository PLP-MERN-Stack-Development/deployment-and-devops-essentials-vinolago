// middleware/monitoring.js - Enhanced application monitoring and metrics

const responseTime = require('response-time');
const os = require('os');

// Global metrics storage
const metrics = {
  requests: {
    total: 0,
    success: 0,
    errors: 0,
    byRoute: {}
  },
  performance: {
    averageResponseTime: 0,
    slowestRequests: [],
    fastestRequests: []
  },
  system: {
    memoryUsage: [],
    cpuUsage: [],
    lastUpdate: null
  }
};

// Response time middleware
const responseTimeMiddleware = responseTime((req, res, time) => {
  const route = `${req.method} ${req.route?.path || req.path}`;
  
  // Initialize route metrics
  if (!metrics.requests.byRoute[route]) {
    metrics.requests.byRoute[route] = {
      count: 0,
      totalTime: 0,
      averageTime: 0,
      errors: 0,
      successes: 0
    };
  }
  
  const routeMetrics = metrics.requests.byRoute[route];
  
  // Update route metrics
  routeMetrics.count++;
  routeMetrics.totalTime += time;
  routeMetrics.averageTime = routeMetrics.totalTime / routeMetrics.count;
  
  // Log slow requests (> 1 second)
  if (time > 1000) {
    console.log(`🚨 Slow request: ${route} took ${time}ms`);
    
    // Add to slowest requests (keep top 10)
    metrics.performance.slowestRequests.push({
      route,
      time,
      timestamp: new Date(),
      status: res.statusCode
    });
    
    metrics.performance.slowestRequests.sort((a, b) => b.time - a.time);
    if (metrics.performance.slowestRequests.length > 10) {
      metrics.performance.slowestRequests.pop();
    }
  }
  
  // Add to fastest requests
  metrics.performance.fastestRequests.push({
    route,
    time,
    timestamp: new Date(),
    status: res.statusCode
  });
  
  metrics.performance.fastestRequests.sort((a, b) => a.time - b.time);
  if (metrics.performance.fastestRequests.length > 10) {
    metrics.performance.fastestRequests.shift();
  }
  
  // Update overall metrics
  metrics.requests.total++;
  if (res.statusCode >= 400) {
    routeMetrics.errors++;
    metrics.requests.errors++;
  } else {
    routeMetrics.successes++;
    metrics.requests.success++;
  }
});

// Request metrics middleware
const requestMetricsMiddleware = (req, res, next) => {
  const start = Date.now();

  // Override res.end to capture response
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;

    // Enhanced metrics logging
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id
    };

    // Log errors with more detail
    if (res.statusCode >= 400) {
      console.error(`❌ Error: ${req.method} ${req.url} ${res.statusCode} ${duration}ms`, logData);
    } else {
      console.log(`✅ ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    }

    // Call original end
    originalEnd.apply(this, args);
  };

  next();
};

// Enhanced memory usage monitoring
const logMemoryUsage = () => {
  const memUsage = process.memoryUsage();
  const systemMemory = {
    total: os.totalmem(),
    free: os.freemem(),
    used: os.totalmem() - os.freemem(),
    percentage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
  };
  
  const cpuUsage = process.cpuUsage();
  
  const timestamp = new Date().toISOString();
  
  // Store in metrics
  metrics.system.memoryUsage.push({
    timestamp,
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    rss: memUsage.rss,
    systemMemory: systemMemory
  });
  
  // Keep only last 100 entries
  if (metrics.system.memoryUsage.length > 100) {
    metrics.system.memoryUsage.shift();
  }
  
  metrics.system.cpuUsage.push({
    timestamp,
    user: cpuUsage.user,
    system: cpuUsage.system
  });
  
  // Keep only last 100 entries
  if (metrics.system.cpuUsage.length > 100) {
    metrics.system.cpuUsage.shift();
  }
  
  metrics.system.lastUpdate = timestamp;
  
  console.log(`📊 Memory: RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB/${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
  console.log(`💻 System Memory: ${Math.round(systemMemory.percentage)}% used, ${Math.round(systemMemory.free / 1024 / 1024)}MB free`);
};

// Resource monitoring thresholds
const checkResourceThresholds = () => {
  const memUsage = process.memoryUsage();
  const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  
  // Memory warnings
  if (memPercent > 90) {
    console.error(`🚨 HIGH MEMORY USAGE: ${Math.round(memPercent)}% (${Math.round(memUsage.heapUsed / 1024 / 1024)}MB)`);
  } else if (memPercent > 80) {
    console.warn(`⚠️ Memory usage: ${Math.round(memPercent)}% (${Math.round(memUsage.heapUsed / 1024 / 1024)}MB)`);
  }
  
  // System memory warnings
  const systemMemPercent = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
  if (systemMemPercent > 90) {
    console.error(`🚨 HIGH SYSTEM MEMORY USAGE: ${Math.round(systemMemPercent)}%`);
  }
};

// API endpoint to get current metrics
const getMetrics = (req, res) => {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  // Calculate error rate
  const errorRate = metrics.requests.total > 0 ? 
    (metrics.requests.errors / metrics.requests.total * 100).toFixed(2) : 0;
  
  res.json({
    timestamp: new Date().toISOString(),
    uptime: uptime,
    requests: metrics.requests,
    performance: {
      averageResponseTime: metrics.performance.averageResponseTime,
      slowestRequests: metrics.performance.slowestRequests.slice(0, 5),
      fastestRequests: metrics.performance.fastestRequests.slice(0, 5)
    },
    memory: {
      process: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapPercentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      },
      system: {
        total: Math.round(os.totalmem() / 1024 / 1024),
        free: Math.round(os.freemem() / 1024 / 1024),
        used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
        percentage: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
      }
    },
    errorRate: `${errorRate}%`
  });
};

// Clear metrics (useful for testing)
const clearMetrics = () => {
  metrics.requests = {
    total: 0,
    success: 0,
    errors: 0,
    byRoute: {}
  };
  metrics.performance = {
    averageResponseTime: 0,
    slowestRequests: [],
    fastestRequests: []
  };
  console.log('📊 Metrics cleared');
};

// Health check integration
const getSystemHealth = () => {
  const memUsage = process.memoryUsage();
  const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  const systemMemPercent = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
  const uptime = process.uptime();
  
  return {
    status: 'healthy',
    uptime: uptime,
    memory: {
      heapPercent: Math.round(memPercent),
      systemPercent: Math.round(systemMemPercent),
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024)
    },
    timestamp: new Date().toISOString()
  };
};

// Log memory usage every 5 minutes in production, every 30 seconds in development
const memoryInterval = process.env.NODE_ENV === 'production' ? 
  5 * 60 * 1000 : 30 * 1000;

setInterval(logMemoryUsage, memoryInterval);
setInterval(checkResourceThresholds, memoryInterval);

// Cleanup intervals on process exit
process.on('SIGTERM', () => {
  clearInterval(memoryInterval);
});

process.on('SIGINT', () => {
  clearInterval(memoryInterval);
});

module.exports = {
  responseTimeMiddleware,
  requestMetricsMiddleware,
  logMemoryUsage,
  getMetrics,
  clearMetrics,
  getSystemHealth,
  metrics
};