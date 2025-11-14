// Enhanced health check and monitoring routes
const express = require('express');
const os = require('os');
const mongoose = require('mongoose');
const router = express.Router();

// Enhanced health check endpoint with liveness and readiness probes
router.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const uptime = process.uptime();
  
  // Calculate system load
  const loadAvg = os.loadavg();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  
  // Check if the application is healthy
  const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  const isHealthy = memPercent < 95;
  
  const healthCheck = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: {
      process: uptime,
      system: os.uptime()
    },
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      redis: 'not_configured', // Placeholder for future Redis
      external_apis: 'unknown'
    },
    performance: {
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
        heapPercentage: Math.round(memPercent),
        external: Math.round(memUsage.external / 1024 / 1024) + 'MB'
      },
      cpu: {
        usage: cpuUsage,
        loadAverage: loadAvg.map(avg => Math.round(avg * 100) / 100)
      },
      system: {
        totalMemory: Math.round(totalMem / 1024 / 1024) + 'MB',
        freeMemory: Math.round(freeMem / 1024 / 1024) + 'MB',
        usedMemoryPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
        platform: os.platform(),
        arch: os.arch(),
        cpuCount: os.cpus().length
      }
    },
    checks: {
      memory: memPercent < 90 ? 'healthy' : (memPercent < 95 ? 'warning' : 'critical'),
      uptime: uptime > 60 ? 'healthy' : 'warning' // Warn if uptime < 1 minute
    }
  };
  
  // Return appropriate status code
  const statusCode = isHealthy ? 200 : (memPercent < 98 ? 429 : 503);
  res.status(statusCode).json(healthCheck);
});

// Kubernetes-style liveness probe
router.get('/health/live', (req, res) => {
  // Basic liveness check - just verify the process is running
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    uptime: process.uptime()
  });
});

// Kubernetes-style readiness probe
router.get('/health/ready', async (req, res) => {
  try {
    // Check database connectivity
    const dbState = mongoose.connection.readyState;
    if (dbState !== 1) {
      return res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        reason: 'Database not connected',
        database_state: dbState
      });
    }
    
    // Test database operation
    await mongoose.connection.db.admin().ping();
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
    
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Detailed health check with dependencies
router.get('/health/detailed', async (req, res) => {
  try {
    const checks = {
      timestamp: new Date().toISOString(),
      overall: 'healthy',
      checks: {}
    };
    
    // Database connectivity check
    try {
      const dbState = mongoose.connection.readyState;
      const states = {
        0: 'disconnected',
        1: 'connected', 
        2: 'connecting',
        3: 'disconnecting'
      };
      
      checks.checks.database = {
        status: dbState === 1 ? 'healthy' : 'unhealthy',
        state: states[dbState],
        name: mongoose.connection.name,
        host: mongoose.connection.host,
        port: mongoose.connection.port
      };
      
      if (dbState === 1) {
        // Ping database
        await mongoose.connection.db.admin().ping();
        checks.checks.database.responseTime = 'OK';
      }
    } catch (error) {
      checks.checks.database = {
        status: 'unhealthy',
        error: error.message
      };
    }
    
    // Memory check
    const memUsage = process.memoryUsage();
    const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    checks.checks.memory = {
      status: memPercent < 90 ? 'healthy' : 'warning',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      percentage: Math.round(memPercent)
    };
    
    // Disk space check (if possible)
    try {
      const fs = require('fs').promises;
      const stats = await fs.stat('/');
      checks.checks.disk = {
        status: 'healthy',
        note: 'Disk space monitoring not available in this environment'
      };
    } catch (error) {
      checks.checks.disk = {
        status: 'unknown',
        error: 'Could not access disk information'
      };
    }
    
    // External service checks (placeholders)
    checks.checks.externalServices = {
      status: 'unknown',
      services: []
    };
    
    // Determine overall status
    const unhealthyChecks = Object.values(checks.checks).filter(check => check.status === 'unhealthy');
    checks.overall = unhealthyChecks.length > 0 ? 'unhealthy' : 'healthy';
    
    res.status(checks.overall === 'healthy' ? 200 : 503).json(checks);
    
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Database specific health check
router.get('/health/db', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting', 
      3: 'disconnecting'
    };
    
    if (dbState !== 1) {
      return res.status(503).json({
        status: 'unhealthy',
        database: {
          state: states[dbState],
          error: 'Database not connected'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Test database operation
    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    const responseTime = Date.now() - start;
    
    res.status(200).json({
      status: 'healthy',
      database: {
        state: states[dbState],
        name: mongoose.connection.name,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        responseTime: responseTime + 'ms'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Metrics endpoint for monitoring tools
router.get('/metrics', (req, res) => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const uptime = process.uptime();
  
  // Prometheus-style metrics
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime_seconds: uptime,
    memory_rss_bytes: memUsage.rss,
    memory_heap_bytes: memUsage.heapUsed,
    cpu_user_seconds: cpuUsage.user,
    cpu_system_seconds: cpuUsage.system,
    active_connections: mongoose.connection.readyState,
    environment: process.env.NODE_ENV
  };
  
  res.json(metrics);
});

module.exports = router;