// Uptime monitoring configuration for Better Uptime
const monitoringConfig = {
  // Better Uptime integration
  betterUptime: {
    enabled: process.env.BETTER_UPTIME_API_KEY ? true : false,
    heartbeatUrl: process.env.BETTER_UPTIME_HEARTBEAT_URL,
    apiKey: process.env.BETTER_UPTIME_API_KEY,
    webhookUrl: process.env.BETTER_UPTIME_WEBHOOK_URL
  },
  
  // Custom monitoring configuration
  monitoring: {
    // Internal monitoring endpoints
    endpoints: {
      health: '/health',
      healthLive: '/health/live', 
      healthReady: '/health/ready',
      metrics: '/metrics'
    },
    
    // Health check thresholds
    thresholds: {
      responseTime: 5000, // 5 seconds
      memoryUsage: 90, // 90% heap usage
      errorRate: 10, // 10% error rate
      uptime: 99.9 // 99.9% uptime requirement
    },
    
    // Monitoring service configurations
    services: {
      render: {
        enabled: true,
        healthCheckPath: '/health',
        deployHook: process.env.RENDER_DEPLOY_HOOK
      },
      betterUptime: {
        enabled: process.env.BETTER_UPTIME_API_KEY ? true : false,
        heartbeatUrl: process.env.BETTER_UPTIME_HEARTBEAT_URL
      },
      pingdom: {
        enabled: process.env.PINGDOM_API_KEY ? true : false,
        apiKey: process.env.PINGDOM_API_KEY,
        email: process.env.PINGDOM_EMAIL,
        password: process.env.PINGDOM_PASSWORD,
        checkId: process.env.PINGDOM_CHECK_ID
      }
    }
  }
};

// Function to send heartbeat to Better Uptime
async function sendBetterUptimeHeartbeat() {
  if (!monitoringConfig.betterUptime.enabled || !monitoringConfig.betterUptime.heartbeatUrl) {
    return { success: false, message: 'Better Uptime not configured' };
  }

  try {
    const response = await fetch(monitoringConfig.betterUptime.heartbeatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    return { 
      success: response.ok, 
      status: response.status,
      message: response.ok ? 'Heartbeat sent successfully' : 'Heartbeat failed'
    };
  } catch (error) {
    console.error('❌ Better Uptime heartbeat failed:', error.message);
    return { success: false, message: error.message };
  }
}

// Function to send custom metrics to monitoring service
async function sendMonitoringMetrics(metrics) {
  const alerts = [];
  
  // Check response time
  if (metrics.avgResponseTime > monitoringConfig.monitoring.thresholds.responseTime) {
    alerts.push({
      type: 'performance',
      message: `High response time: ${metrics.avgResponseTime}ms`,
      severity: 'warning'
    });
  }
  
  // Check memory usage
  if (metrics.memoryUsage > monitoringConfig.monitoring.thresholds.memoryUsage) {
    alerts.push({
      type: 'resource',
      message: `High memory usage: ${metrics.memoryUsage}%`,
      severity: 'critical'
    });
  }
  
  // Check error rate
  if (metrics.errorRate > monitoringConfig.monitoring.thresholds.errorRate) {
    alerts.push({
      type: 'reliability',
      message: `High error rate: ${metrics.errorRate}%`,
      severity: 'critical'
    });
  }
  
  return alerts;
}

// Function to check if all monitoring checks are healthy
async function performHealthCheck() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  const checks = {
    timestamp: new Date().toISOString(),
    overall: 'healthy',
    checks: {}
  };
  
  try {
    // Check main health endpoint
    const healthResponse = await fetch(`${baseUrl}/health`);
    checks.checks.health = {
      status: healthResponse.ok ? 'healthy' : 'unhealthy',
      statusCode: healthResponse.status,
      responseTime: Date.now()
    };
    
    // Check liveness probe
    const liveResponse = await fetch(`${baseUrl}/health/live`);
    checks.checks.liveness = {
      status: liveResponse.ok ? 'healthy' : 'unhealthy',
      statusCode: liveResponse.status
    };
    
    // Check readiness probe
    const readyResponse = await fetch(`${baseUrl}/health/ready`);
    checks.checks.readiness = {
      status: readyResponse.ok ? 'healthy' : 'unhealthy',
      statusCode: readyResponse.status
    };
    
    // Check metrics endpoint
    const metricsResponse = await fetch(`${baseUrl}/metrics`);
    checks.checks.metrics = {
      status: metricsResponse.ok ? 'healthy' : 'unhealthy',
      statusCode: metricsResponse.status
    };
    
    // Determine overall status
    const unhealthyChecks = Object.values(checks.checks).filter(check => check.status === 'unhealthy');
    checks.overall = unhealthyChecks.length > 0 ? 'unhealthy' : 'healthy';
    
  } catch (error) {
    checks.overall = 'unhealthy';
    checks.error = error.message;
    console.error('❌ Health check failed:', error.message);
  }
  
  return checks;
}

// Function to send alerts to monitoring services
async function sendAlert(alert) {
  // Send to Better Uptime if configured
  if (monitoringConfig.betterUptime.enabled && monitoringConfig.betterUptime.webhookUrl) {
    try {
      await fetch(monitoringConfig.betterUptime.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: alert.message,
          description: `Alert type: ${alert.type}, Severity: ${alert.severity}`,
          severity: alert.severity,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('❌ Failed to send Better Uptime alert:', error.message);
    }
  }
}

// Scheduled monitoring tasks
function scheduleMonitoringTasks() {
  // Send heartbeat every 5 minutes
  setInterval(async () => {
    const result = await sendBetterUptimeHeartbeat();
    console.log(`💓 Better Uptime heartbeat: ${result.message}`);
  }, 5 * 60 * 1000);
  
  // Perform health checks every minute
  setInterval(async () => {
    const health = await performHealthCheck();
    if (health.overall === 'unhealthy') {
      await sendAlert({
        type: 'availability',
        message: 'Service health check failed',
        severity: 'critical'
      });
    }
  }, 60 * 1000);
  
  console.log('📊 Monitoring tasks scheduled');
}

// Export monitoring functions
module.exports = {
  monitoringConfig,
  sendBetterUptimeHeartbeat,
  sendMonitoringMetrics,
  performHealthCheck,
  sendAlert,
  scheduleMonitoringTasks
};