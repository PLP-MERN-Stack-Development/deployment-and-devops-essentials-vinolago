// Advanced Performance Monitoring System
const os = require('os');
const process = require('process');
const { randomUUID: uuidv4 } = require('crypto');

// Performance metrics storage
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byRoute: {},
        byStatus: {},
        responseTimes: [],
        slowRequests: [],
        errors: []
      },
      resources: {
        cpu: {
          history: [],
          current: { user: 0, system: 0, idle: 100 },
          usage: 0
        },
        memory: {
          heap: {
            used: 0,
            total: 0,
            external: 0,
            history: []
          },
          process: {
            rss: 0,
            heapUsed: 0,
            heapTotal: 0,
            external: 0,
            history: []
          },
          system: {
            total: 0,
            free: 0,
            used: 0,
            percentage: 0,
            history: []
          }
        },
        network: {
          bytesIn: 0,
          bytesOut: 0,
          history: []
        },
        disk: {
          read: 0,
          write: 0,
          history: []
        }
      },
      database: {
        connections: {
          active: 0,
          idle: 0,
          waiting: 0,
          total: 0
        },
        queries: {
          total: 0,
          slow: 0,
          averageTime: 0,
          history: []
        },
        performance: {
          averageQueryTime: 0,
          slowQueries: [],
          connectionPool: {
            total: 10,
            active: 0,
            idle: 0,
            waiting: 0
          }
        }
      },
      api: {
        endpoints: {},
        rateLimit: {
          requests: new Map(),
          blocked: 0
        },
        cache: {
          hits: 0,
          misses: 0,
          hitRatio: 0
        }
      },
      events: []
    };
    
    this.startTime = Date.now();
    this.lastCpuSample = process.cpuUsage();
    this.lastNetworkSample = this.getNetworkStats();
    
    // Start monitoring intervals
    this.startMonitoring();
  }

  // Initialize monitoring
  startMonitoring() {
    // Sample CPU every 5 seconds
    this.cpuInterval = setInterval(() => {
      this.sampleCpuUsage();
    }, 5000);
    
    // Sample memory every 10 seconds
    this.memoryInterval = setInterval(() => {
      this.sampleMemoryUsage();
    }, 10000);
    
    // Sample network every 15 seconds
    this.networkInterval = setInterval(() => {
      this.sampleNetworkUsage();
    }, 15000);
    
    // Clean up old data every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);
    
    console.log('📊 Performance monitoring started');
  }

  // Stop monitoring
  stopMonitoring() {
    clearInterval(this.cpuInterval);
    clearInterval(this.memoryInterval);
    clearInterval(this.networkInterval);
    clearInterval(this.cleanupInterval);
    console.log('📊 Performance monitoring stopped');
  }

  // Request performance tracking middleware
  requestMiddleware() {
    return (req, res, next) => {
      const requestId = uuidv4();
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();
      
      // Attach request tracking to request object
      req.performance = {
        id: requestId,
        startTime,
        startMemory,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      };
      
      // Override res.end to capture response
      const originalEnd = res.end;
      res.end = function(...args) {
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        // Record request performance
        performanceMonitor.recordRequest({
          id: requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          startMemory,
          endMemory,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          user: req.user?.id || 'anonymous'
        });
        
        originalEnd.apply(res, args);
      };
      
      next();
    };
  }

  // Database query performance tracking
  trackDatabaseQuery(query, duration) {
    this.metrics.database.queries.total++;
    
    const queryData = {
      query: query.substring(0, 100), // Truncate long queries
      duration,
      timestamp: Date.now(),
      id: uuidv4()
    };
    
    this.metrics.database.queries.history.push(queryData);
    
    // Track slow queries (> 100ms)
    if (duration > 100) {
      this.metrics.database.queries.slow++;
      this.metrics.database.performance.slowQueries.push(queryData);
      
      // Keep only last 50 slow queries
      if (this.metrics.database.performance.slowQueries.length > 50) {
        this.metrics.database.performance.slowQueries.shift();
      }
    }
    
    // Update average query time
    this.metrics.database.queries.averageTime = 
      (this.metrics.database.queries.averageTime * (this.metrics.database.queries.total - 1) + duration) / 
      this.metrics.database.queries.total;
  }

  // API endpoint performance tracking
  trackApiEndpoint(path, method, duration, statusCode) {
    if (!this.metrics.api.endpoints[path]) {
      this.metrics.api.endpoints[path] = {
        method,
        totalRequests: 0,
        totalDuration: 0,
        averageDuration: 0,
        statusCodes: {},
        slowest: 0,
        fastest: Infinity
      };
    }
    
    const endpoint = this.metrics.api.endpoints[path];
    endpoint.totalRequests++;
    endpoint.totalDuration += duration;
    endpoint.averageDuration = endpoint.totalDuration / endpoint.totalRequests;
    
    if (!endpoint.statusCodes[statusCode]) {
      endpoint.statusCodes[statusCode] = 0;
    }
    endpoint.statusCodes[statusCode]++;
    
    if (duration > endpoint.slowest) {
      endpoint.slowest = duration;
    }
    
    if (duration < endpoint.fastest) {
      endpoint.fastest = duration;
    }
  }

  // Resource sampling methods
  sampleCpuUsage() {
    const now = Date.now();
    const currentCpuSample = process.cpuUsage(this.lastCpuSample);
    const totalUsage = currentCpuSample.user + currentCpuSample.system;
    
    this.metrics.resources.cpu.current = {
      user: currentCpuSample.user,
      system: currentCpuSample.system,
      idle: Math.max(0, 1000000 - totalUsage)
    };
    
    this.metrics.resources.cpu.usage = (totalUsage / 1000000) * 100;
    
    this.metrics.resources.cpu.history.push({
      timestamp: now,
      usage: this.metrics.resources.cpu.usage,
      user: currentCpuSample.user,
      system: currentCpuSample.system
    });
    
    // Keep only last 100 samples (about 8 minutes at 5s intervals)
    if (this.metrics.resources.cpu.history.length > 100) {
      this.metrics.resources.cpu.history.shift();
    }
    
    this.lastCpuSample = process.cpuUsage();
  }

  sampleMemoryUsage() {
    const now = Date.now();
    const memUsage = process.memoryUsage();
    const systemMem = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem(),
      percentage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
    };
    
    // Process memory - update values, preserve history
    this.metrics.resources.memory.process.rss = memUsage.rss;
    this.metrics.resources.memory.process.heapUsed = memUsage.heapUsed;
    this.metrics.resources.memory.process.heapTotal = memUsage.heapTotal;
    this.metrics.resources.memory.process.external = memUsage.external;
    
    this.metrics.resources.memory.process.history.push({
      timestamp: now,
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal
    });
    
    // System memory - update values, preserve history
    this.metrics.resources.memory.system.total = systemMem.total;
    this.metrics.resources.memory.system.free = systemMem.free;
    this.metrics.resources.memory.system.used = systemMem.used;
    this.metrics.resources.memory.system.percentage = systemMem.percentage;
    
    this.metrics.resources.memory.system.history.push({
      timestamp: now,
      total: systemMem.total,
      free: systemMem.free,
      used: systemMem.used,
      percentage: systemMem.percentage
    });
    
    // Keep only last 100 samples
    if (this.metrics.resources.memory.process.history.length > 100) {
      this.metrics.resources.memory.process.history.shift();
    }
    
    if (this.metrics.resources.memory.system.history.length > 100) {
      this.metrics.resources.memory.system.history.shift();
    }
  }

  sampleNetworkUsage() {
    const now = Date.now();
    const currentNetwork = this.getNetworkStats();
    
    const bytesIn = currentNetwork.bytesIn - this.lastNetworkSample.bytesIn;
    const bytesOut = currentNetwork.bytesOut - this.lastNetworkSample.bytesOut;
    
    this.metrics.resources.network.history.push({
      timestamp: now,
      bytesIn,
      bytesOut,
      bytesInPerSecond: bytesIn / 15, // 15 second interval
      bytesOutPerSecond: bytesOut / 15
    });
    
    this.metrics.resources.network.bytesIn += bytesIn;
    this.metrics.resources.network.bytesOut += bytesOut;
    
    // Keep only last 100 samples
    if (this.metrics.resources.network.history.length > 100) {
      this.metrics.resources.network.history.shift();
    }
    
    this.lastNetworkSample = currentNetwork;
  }

  // Helper methods
  getNetworkStats() {
    // This is a simplified version - in production you'd use a library like 'systeminformation'
    return {
      bytesIn: 0,
      bytesOut: 0
    };
  }

  recordRequest(requestData) {
    const { id, method, path, statusCode, duration, userAgent, ip, user } = requestData;
    
    this.metrics.requests.total++;
    
    // Track by method
    if (!this.metrics.requests.byMethod[method]) {
      this.metrics.requests.byMethod[method] = 0;
    }
    this.metrics.requests.byMethod[method]++;
    
    // Track by status code
    if (!this.metrics.requests.byStatus[statusCode]) {
      this.metrics.requests.byStatus[statusCode] = 0;
    }
    this.metrics.requests.byStatus[statusCode]++;
    
    // Track response times
    this.metrics.requests.responseTimes.push({
      timestamp: Date.now(),
      duration,
      method,
      path,
      statusCode
    });
    
    // Keep only last 1000 response times
    if (this.metrics.requests.responseTimes.length > 1000) {
      this.metrics.requests.responseTimes.shift();
    }
    
    // Track slow requests (> 1 second)
    if (duration > 1000) {
      this.metrics.requests.slowRequests.push({
        id,
        method,
        path,
        duration,
        statusCode,
        timestamp: Date.now(),
        userAgent,
        ip,
        user
      });
      
      // Keep only last 50 slow requests
      if (this.metrics.requests.slowRequests.length > 50) {
        this.metrics.requests.slowRequests.shift();
      }
    }
    
    // Track API endpoint performance
    this.trackApiEndpoint(path, method, duration, statusCode);
    
    // Track errors
    if (statusCode >= 400) {
      this.metrics.requests.errors.push({
        id,
        method,
        path,
        statusCode,
        duration,
        timestamp: Date.now(),
        userAgent,
        ip,
        user
      });
      
      // Keep only last 100 errors
      if (this.metrics.requests.errors.length > 100) {
        this.metrics.requests.errors.shift();
      }
    }
  }

  // Get performance statistics
  getStats() {
    const now = Date.now();
    const uptime = (now - this.startTime) / 1000; // in seconds
    
    // Calculate request rate (requests per second)
    const requestRate = this.metrics.requests.total / uptime;
    
    // Calculate error rate
    const errorRate = (this.metrics.requests.errors.length / this.metrics.requests.total) * 100;
    
    // Calculate average response time
    const avgResponseTime = this.metrics.requests.responseTimes.length > 0 
      ? this.metrics.requests.responseTimes.reduce((sum, req) => sum + req.duration, 0) / this.metrics.requests.responseTimes.length 
      : 0;
    
    // Get percentile response times
    const responseTimes = this.metrics.requests.responseTimes.map(req => req.duration).sort((a, b) => a - b);
    const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)] || 0;
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
    const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;
    
    return {
      uptime,
      requestRate: Math.round(requestRate * 100) / 100,
      totalRequests: this.metrics.requests.total,
      errorRate: Math.round(errorRate * 100) / 100,
      averageResponseTime: Math.round(avgResponseTime * 100) / 100,
      responseTimePercentiles: {
        p50: Math.round(p50 * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
        p99: Math.round(p99 * 100) / 100
      },
      resources: {
        cpu: this.metrics.resources.cpu,
        memory: this.metrics.resources.memory,
        network: this.metrics.resources.network
      },
      database: this.metrics.database,
      api: {
        endpoints: this.metrics.api.endpoints,
        slowRequests: this.metrics.requests.slowRequests.slice(0, 10),
        errors: this.metrics.requests.errors.slice(0, 10)
      }
    };
  }

  // Clean up old data
  cleanupOldData() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Clean up response times older than 1 hour
    this.metrics.requests.responseTimes = this.metrics.requests.responseTimes.filter(
      req => req.timestamp > oneHourAgo
    );
    
    // Clean up slow requests older than 1 hour
    this.metrics.requests.slowRequests = this.metrics.requests.slowRequests.filter(
      req => req.timestamp > oneHourAgo
    );
    
    // Clean up errors older than 1 hour
    this.metrics.requests.errors = this.metrics.requests.errors.filter(
      req => req.timestamp > oneHourAgo
    );
    
    // Clean up query history older than 1 hour
    this.metrics.database.queries.history = this.metrics.database.queries.history.filter(
      query => query.timestamp > oneHourAgo
    );
    
    console.log('🧹 Performance data cleanup completed');
  }

  // Reset all metrics
  reset() {
    this.metrics.requests = {
      total: 0,
      byMethod: {},
      byRoute: {},
      byStatus: {},
      responseTimes: [],
      slowRequests: [],
      errors: []
    };
    
    this.metrics.database.queries.total = 0;
    this.metrics.database.queries.slow = 0;
    this.metrics.database.queries.averageTime = 0;
    this.metrics.database.queries.history = [];
    this.metrics.database.performance.slowQueries = [];
    
    this.startTime = Date.now();
    
    console.log('📊 Performance metrics reset');
  }
}

// Create global instance
const performanceMonitor = new PerformanceMonitor();

module.exports = {
  performanceMonitor,
  PerformanceMonitor
};