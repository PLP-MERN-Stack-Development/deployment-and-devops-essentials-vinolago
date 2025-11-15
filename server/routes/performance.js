// API Performance Tracking Routes
const express = require('express');
const { performanceMonitor } = require('../../monitoring/performance-monitor');
const router = express.Router();

// Get performance statistics
router.get('/performance/stats', (req, res) => {
  try {
    const stats = performanceMonitor.getStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get request performance metrics
router.get('/performance/requests', (req, res) => {
  try {
    const { 
      limit = 50, 
      sortBy = 'timestamp', 
      sortOrder = 'desc',
      statusCode,
      method,
      path
    } = req.query;

    let requests = performanceMonitor.metrics.requests.responseTimes;

    // Apply filters
    if (statusCode) {
      requests = requests.filter(req => req.statusCode.toString() === statusCode);
    }
    if (method) {
      requests = requests.filter(req => req.method === method.toUpperCase());
    }
    if (path) {
      requests = requests.filter(req => req.path.includes(path));
    }

    // Sort
    requests.sort((a, b) => {
      const aValue = a[sortBy] || 0;
      const bValue = b[sortBy] || 0;
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    // Limit results
    requests = requests.slice(0, parseInt(limit));

    // Calculate summary statistics
    const durations = requests.map(req => req.duration);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;

    // Calculate percentiles
    durations.sort((a, b) => a - b);
    const p50 = durations[Math.floor(durations.length * 0.5)] || 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
    const p99 = durations[Math.floor(durations.length * 0.99)] || 0;

    res.json({
      success: true,
      data: {
        requests,
        summary: {
          total: requests.length,
          average: Math.round(avgDuration * 100) / 100,
          min: Math.round(minDuration * 100) / 100,
          max: Math.round(maxDuration * 100) / 100,
          percentiles: {
            p50: Math.round(p50 * 100) / 100,
            p95: Math.round(p95 * 100) / 100,
            p99: Math.round(p99 * 100) / 100
          }
        },
        filters: {
          statusCode,
          method,
          path,
          limit: parseInt(limit),
          sortBy,
          sortOrder
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get slow requests
router.get('/performance/slow-requests', (req, res) => {
  try {
    const { limit = 20, threshold = 1000 } = req.query;

    const slowRequests = performanceMonitor.metrics.requests.slowRequests
      .filter(req => req.duration >= parseInt(threshold))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      data: {
        slowRequests,
        count: slowRequests.length,
        threshold: parseInt(threshold)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get error requests
router.get('/performance/errors', (req, res) => {
  try {
    const { limit = 20, statusCode, method } = req.query;

    let errors = performanceMonitor.metrics.requests.errors;

    // Apply filters
    if (statusCode) {
      errors = errors.filter(err => err.statusCode.toString() === statusCode);
    }
    if (method) {
      errors = errors.filter(err => err.method === method.toUpperCase());
    }

    // Sort by timestamp (newest first)
    errors.sort((a, b) => b.timestamp - a.timestamp);

    // Limit results
    errors = errors.slice(0, parseInt(limit));

    // Calculate error summary
    const errorSummary = {};
    errors.forEach(err => {
      if (!errorSummary[err.statusCode]) {
        errorSummary[err.statusCode] = 0;
      }
      errorSummary[err.statusCode]++;
    });

    res.json({
      success: true,
      data: {
        errors,
        summary: errorSummary,
        total: errors.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get API endpoint performance
router.get('/performance/endpoints', (req, res) => {
  try {
    const { sortBy = 'totalRequests', sortOrder = 'desc' } = req.query;

    const endpoints = Object.entries(performanceMonitor.metrics.api.endpoints).map(([path, data]) => ({
      path,
      ...data
    }));

    // Sort endpoints
    endpoints.sort((a, b) => {
      const aValue = a[sortBy] || 0;
      const bValue = b[sortBy] || 0;
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    // Calculate summary statistics
    const totalRequests = endpoints.reduce((sum, ep) => sum + ep.totalRequests, 0);
    const avgResponseTime = endpoints.length > 0 
      ? endpoints.reduce((sum, ep) => sum + ep.averageDuration, 0) / endpoints.length 
      : 0;

    res.json({
      success: true,
      data: {
        endpoints,
        summary: {
          totalEndpoints: endpoints.length,
          totalRequests,
          averageResponseTime: Math.round(avgResponseTime * 100) / 100,
          slowestEndpoint: endpoints[0]?.path || null,
          fastestEndpoint: endpoints[endpoints.length - 1]?.path || null
        },
        sortBy,
        sortOrder
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get database performance metrics
router.get('/performance/database', (req, res) => {
  try {
    const database = performanceMonitor.metrics.database;
    
    // Get recent queries
    const recentQueries = database.queries.history
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);

    // Get slow queries
    const slowQueries = database.performance.slowQueries
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    // Calculate query performance summary
    const queryTimes = recentQueries.map(q => q.duration);
    const avgQueryTime = queryTimes.length > 0 
      ? queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length 
      : 0;

    const queryTimeDistribution = {
      fast: queryTimes.filter(t => t < 50).length,
      medium: queryTimes.filter(t => t >= 50 && t < 200).length,
      slow: queryTimes.filter(t => t >= 200 && t < 500).length,
      verySlow: queryTimes.filter(t => t >= 500).length
    };

    res.json({
      success: true,
      data: {
        queries: {
          total: database.queries.total,
          slow: database.queries.slow,
          averageTime: Math.round(database.queries.averageTime * 100) / 100,
          recent: recentQueries,
          slow: slowQueries
        },
        performance: {
          averageQueryTime: Math.round(avgQueryTime * 100) / 100,
          distribution: queryTimeDistribution
        },
        connections: database.connections,
        pool: database.performance.connectionPool
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get resource usage metrics
router.get('/performance/resources', (req, res) => {
  try {
    const resources = performanceMonitor.metrics.resources;
    
    // Calculate resource usage summary
    const currentMemory = resources.memory.process;
    const systemMemory = resources.memory.system;
    
    // Get recent resource history (last 20 samples)
    const recentCpuHistory = resources.cpu.history.slice(-20);
    const recentMemoryHistory = resources.memory.process.history.slice(-20);
    const recentSystemMemoryHistory = resources.memory.system.history.slice(-20);

    // Calculate trends
    const cpuTrend = recentCpuHistory.length >= 2 
      ? recentCpuHistory[recentCpuHistory.length - 1].usage - recentCpuHistory[0].usage 
      : 0;
    
    const memoryTrend = recentMemoryHistory.length >= 2
      ? ((recentMemoryHistory[recentMemoryHistory.length - 1].heapUsed / recentMemoryHistory[recentMemoryHistory.length - 1].heapTotal) * 100) -
        ((recentMemoryHistory[0].heapUsed / recentMemoryHistory[0].heapTotal) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        cpu: {
          current: {
            usage: Math.round(resources.cpu.usage * 100) / 100,
            user: resources.cpu.current.user,
            system: resources.cpu.current.system,
            idle: resources.cpu.current.idle
          },
          history: recentCpuHistory,
          trend: Math.round(cpuTrend * 100) / 100
        },
        memory: {
          process: {
            current: {
              rss: Math.round(currentMemory.rss / 1024 / 1024), // MB
              heapUsed: Math.round(currentMemory.heapUsed / 1024 / 1024), // MB
              heapTotal: Math.round(currentMemory.heapTotal / 1024 / 1024), // MB
              percentage: Math.round((currentMemory.heapUsed / currentMemory.heapTotal) * 100)
            },
            history: recentMemoryHistory
          },
          system: {
            current: {
              total: Math.round(systemMemory.total / 1024 / 1024), // MB
              free: Math.round(systemMemory.free / 1024 / 1024), // MB
              used: Math.round(systemMemory.used / 1024 / 1024), // MB
              percentage: Math.round(systemMemory.percentage * 100) / 100
            },
            history: recentSystemMemoryHistory
          },
          trend: Math.round(memoryTrend * 100) / 100
        },
        network: {
          current: {
            bytesIn: resources.network.bytesIn,
            bytesOut: resources.network.bytesOut
          },
          history: resources.network.history.slice(-20)
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get real-time performance metrics
router.get('/performance/realtime', (req, res) => {
  try {
    const stats = performanceMonitor.getStats();
    
    // Get current timestamp
    const now = new Date().toISOString();
    
    // Create real-time summary
    const realtimeData = {
      timestamp: now,
      status: 'healthy',
      alerts: [],
      metrics: {
        requestsPerSecond: stats.requestRate,
        errorRate: stats.errorRate,
        responseTime: stats.averageResponseTime,
        cpuUsage: stats.resources.cpu.usage,
        memoryUsage: Math.round((stats.resources.memory.process.heapUsed / stats.resources.memory.process.heapTotal) * 100)
      }
    };
    
    // Check for performance issues
    if (stats.errorRate > 5) {
      realtimeData.status = 'warning';
      realtimeData.alerts.push({
        type: 'error_rate',
        message: `High error rate: ${stats.errorRate}%`,
        severity: 'warning'
      });
    }
    
    if (stats.resources.cpu.usage > 80) {
      realtimeData.status = 'warning';
      realtimeData.alerts.push({
        type: 'cpu_usage',
        message: `High CPU usage: ${stats.resources.cpu.usage}%`,
        severity: 'warning'
      });
    }
    
    if (stats.averageResponseTime > 1000) {
      realtimeData.status = 'warning';
      realtimeData.alerts.push({
        type: 'response_time',
        message: `Slow response time: ${stats.averageResponseTime}ms`,
        severity: 'warning'
      });
    }
    
    if (stats.responseTimePercentiles.p99 > 5000) {
      realtimeData.status = 'critical';
      realtimeData.alerts.push({
        type: 'response_time',
        message: `Very high P99 response time: ${stats.responseTimePercentiles.p99}ms`,
        severity: 'critical'
      });
    }
    
    res.json({
      success: true,
      data: realtimeData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Reset performance metrics (admin only)
router.post('/performance/reset', (req, res) => {
  try {
    const { apiKey } = req.body;
    
    // Simple API key check (in production, use proper authentication)
    if (apiKey !== process.env.MONITORING_API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    performanceMonitor.reset();
    
    res.json({
      success: true,
      message: 'Performance metrics reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;