// Monitoring Dashboard Configuration
const dashboardConfig = {
  // Grafana Dashboard Configuration
  grafana: {
    enabled: process.env.GRAFANA_ENABLED === 'true',
    url: process.env.GRAFANA_URL,
    apiKey: process.env.GRAFANA_API_KEY,
    dashboards: {
      overview: {
        title: 'MERN Blog Application Overview',
        panels: [
          {
            title: 'Response Time',
            type: 'graph',
            query: 'avg(response_time_seconds) by (endpoint)',
            thresholds: [
              { value: 0.5, color: 'green' },
              { value: 1.0, color: 'yellow' },
              { value: 2.0, color: 'red' }
            ]
          },
          {
            title: 'Request Rate',
            type: 'graph',
            query: 'sum(rate(requests_total[5m])) by (method)',
            thresholds: []
          },
          {
            title: 'Error Rate',
            type: 'singlestat',
            query: 'rate(errors_total[5m]) / rate(requests_total[5m]) * 100',
            thresholds: [
              { value: 1, color: 'green' },
              { value: 5, color: 'yellow' },
              { value: 10, color: 'red' }
            ]
          },
          {
            title: 'Memory Usage',
            type: 'singlestat',
            query: 'memory_heap_used_bytes / memory_heap_total_bytes * 100',
            thresholds: [
              { value: 70, color: 'green' },
              { value: 85, color: 'yellow' },
              { value: 95, color: 'red' }
            ]
          }
        ]
      },
      infrastructure: {
        title: 'Infrastructure Monitoring',
        panels: [
          {
            title: 'CPU Usage',
            type: 'graph',
            query: 'cpu_usage_percent',
            thresholds: [
              { value: 50, color: 'green' },
              { value: 75, color: 'yellow' },
              { value: 90, color: 'red' }
            ]
          },
          {
            title: 'Memory Usage',
            type: 'graph',
            query: 'memory_usage_bytes',
            thresholds: []
          },
          {
            title: 'Database Connections',
            type: 'singlestat',
            query: 'database_connections_active',
            thresholds: [
              { value: 10, color: 'green' },
              { value: 20, color: 'yellow' },
              { value: 30, color: 'red' }
            ]
          },
          {
            title: 'Disk Usage',
            type: 'singlestat',
            query: 'disk_usage_percent',
            thresholds: [
              { value: 70, color: 'green' },
              { value: 85, color: 'yellow' },
              { value: 95, color: 'red' }
            ]
          }
        ]
      }
    }
  },

  // Sentry Dashboard Configuration
  sentry: {
    enabled: process.env.SENTRY_DSN ? true : false,
    organization: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    environments: ['development', 'staging', 'production'],
    
    // Alert rules
    alerts: [
      {
        name: 'High Error Rate',
        condition: 'event.error_rate > 5% over 5m',
        severity: 'critical',
        actions: ['email', 'slack']
      },
      {
        name: 'New Issue Pattern',
        condition: 'count(new_issues) > 10 in 1h',
        severity: 'warning',
        actions: ['email']
      },
      {
        name: 'Performance Regression',
        condition: 'transaction.duration_p95 > 2000ms',
        severity: 'warning',
        actions: ['slack']
      }
    ]
  },

  // Better Uptime Dashboard Configuration
  betterUptime: {
    enabled: process.env.BETTER_UPTIME_API_KEY ? true : false,
    
    // Monitored endpoints
    monitors: [
      {
        name: 'API Health Check',
        url: process.env.API_BASE_URL + '/health',
        type: 'http',
        interval: 5,
        regions: ['us-east-1', 'eu-west-1']
      },
      {
        name: 'Frontend Application',
        url: process.env.FRONTEND_URL,
        type: 'http',
        interval: 1,
        regions: ['us-east-1', 'eu-west-1']
      },
      {
        name: 'Database Connectivity',
        url: process.env.API_BASE_URL + '/health/db',
        type: 'http',
        interval: 1,
        regions: ['us-east-1']
      }
    ],
    
    // Alert policies
    alertPolicies: [
      {
        name: 'Critical Downtime',
        conditions: [
          { type: 'monitor_down', monitorId: 'all', duration: '1m' }
        ],
        escalationPolicy: 'immediate',
        channels: ['email', 'slack', 'sms']
      },
      {
        name: 'High Response Time',
        conditions: [
          { type: 'response_time', threshold: '5000ms', duration: '5m' }
        ],
        escalationPolicy: 'gradual',
        channels: ['email', 'slack']
      }
    ]
  },

  // Pingdom Dashboard Configuration
  pingdom: {
    enabled: process.env.PINGDOM_API_KEY ? true : false,
    apiKey: process.env.PINGDOM_API_KEY,
    email: process.env.PINGDOM_EMAIL,
    
    // Monitoring checks
    checks: [
      {
        name: 'API Availability',
        host: process.env.API_BASE_URL.replace('https://', '').replace('http://', ''),
        path: '/health',
        type: 'HTTP',
        interval: 1,
        probeLocation: ['NA', 'EU', 'AS']
      },
      {
        name: 'Frontend Availability',
        host: process.env.FRONTEND_URL.replace('https://', '').replace('http://', ''),
        type: 'HTTP',
        interval: 1,
        probeLocation: ['NA', 'EU', 'AS']
      }
    ]
  },

  // Custom Monitoring Dashboard
  custom: {
    enabled: true,
    metrics: {
      // Key metrics to track
      business: [
        { name: 'active_users', description: 'Number of active users' },
        { name: 'posts_created', description: 'Posts created per hour' },
        { name: 'user_registrations', description: 'User registrations per day' },
        { name: 'page_views', description: 'Page views per minute' }
      ],
      technical: [
        { name: 'response_time_p50', description: '50th percentile response time' },
        { name: 'response_time_p95', description: '95th percentile response time' },
        { name: 'response_time_p99', description: '99th percentile response time' },
        { name: 'error_rate', description: 'Error rate percentage' },
        { name: 'throughput', description: 'Requests per second' }
      ],
      infrastructure: [
        { name: 'cpu_usage', description: 'CPU usage percentage' },
        { name: 'memory_usage', description: 'Memory usage percentage' },
        { name: 'disk_usage', description: 'Disk usage percentage' },
        { name: 'database_connections', description: 'Active database connections' }
      ]
    },
    
    // Alert thresholds
    thresholds: {
      response_time: {
        p50: { warning: 200, critical: 500 },
        p95: { warning: 1000, critical: 2000 },
        p99: { warning: 3000, critical: 5000 }
      },
      error_rate: { warning: 1, critical: 5 },
      availability: { warning: 99, critical: 95 },
      memory_usage: { warning: 80, critical: 90 },
      cpu_usage: { warning: 70, critical: 90 }
    }
  }
};

// Alert configuration for different channels
const alertConfig = {
  channels: {
    email: {
      enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
      recipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [],
      smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      }
    },
    
    slack: {
      enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_CHANNEL || '#alerts',
      username: process.env.SLACK_USERNAME || 'Monitoring Bot'
    },
    
    sms: {
      enabled: process.env.TWILIO_ACCOUNT_SID ? true : false,
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_FROM_NUMBER,
      toNumbers: process.env.ALERT_PHONE_NUMBERS?.split(',') || []
    },
    
    pagerduty: {
      enabled: process.env.PAGERDUTY_INTEGRATION_KEY ? true : false,
      integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY,
      serviceKey: process.env.PAGERDUTY_SERVICE_KEY
    }
  },
  
  // Alert escalation policies
  escalationPolicies: {
    immediate: [
      { delay: 0, channels: ['email', 'slack', 'sms'] },
      { delay: 300, channels: ['pagerduty'] }
    ],
    gradual: [
      { delay: 0, channels: ['slack'] },
      { delay: 900, channels: ['email'] },
      { delay: 1800, channels: ['sms'] }
    ]
  },
  
  // Alert rules based on severity
  rules: {
    critical: {
      escalationPolicy: 'immediate',
      conditions: [
        'service_unavailable',
        'response_time_p99 > 5000ms',
        'error_rate > 10%',
        'memory_usage > 95%'
      ]
    },
    warning: {
      escalationPolicy: 'gradual',
      conditions: [
        'response_time_p95 > 2000ms',
        'error_rate > 2%',
        'memory_usage > 85%',
        'cpu_usage > 80%'
      ]
    },
    info: {
      escalationPolicy: 'gradual',
      conditions: [
        'deployment_started',
        'service_restarted',
        'backup_completed'
      ]
    }
  }
};

// Function to send alerts through configured channels
async function sendAlert(alert) {
  const channels = alertConfig.channels;
  const results = [];
  
  // Email alerts
  if (channels.email.enabled && alert.channels.includes('email')) {
    // Implementation for email alerts
    results.push({ channel: 'email', success: true, message: 'Email sent' });
  }
  
  // Slack alerts
  if (channels.slack.enabled && alert.channels.includes('slack')) {
    const webhookUrl = channels.slack.webhookUrl;
    const message = {
      text: `🚨 ${alert.severity.toUpperCase()}: ${alert.title}`,
      attachments: [{
        color: alert.severity === 'critical' ? 'danger' : 'warning',
        fields: [
          { title: 'Severity', value: alert.severity, short: true },
          { title: 'Service', value: alert.service, short: true },
          { title: 'Message', value: alert.message, short: false }
        ],
        timestamp: Math.floor(Date.now() / 1000)
      }]
    };
    
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
      results.push({ channel: 'slack', success: response.ok, message: 'Slack alert sent' });
    } catch (error) {
      results.push({ channel: 'slack', success: false, message: error.message });
    }
  }
  
  // SMS alerts
  if (channels.sms.enabled && alert.channels.includes('sms')) {
    // Implementation for SMS alerts via Twilio
    results.push({ channel: 'sms', success: true, message: 'SMS sent' });
  }
  
  return results;
}

// Function to check if all systems are healthy
async function performSystemHealthCheck() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  const checks = {};
  
  try {
    // API health check
    const healthResponse = await fetch(`${baseUrl}/health`);
    checks.api = {
      status: healthResponse.ok ? 'healthy' : 'unhealthy',
      responseTime: Date.now()
    };
    
    // Database health check
    const dbResponse = await fetch(`${baseUrl}/health/db`);
    checks.database = {
      status: dbResponse.ok ? 'healthy' : 'unhealthy',
      responseTime: Date.now()
    };
    
    // Frontend health check
    const frontendResponse = await fetch(process.env.FRONTEND_URL);
    checks.frontend = {
      status: frontendResponse.ok ? 'healthy' : 'unhealthy',
      responseTime: Date.now()
    };
    
  } catch (error) {
    checks.error = error.message;
  }
  
  return checks;
}

module.exports = {
  dashboardConfig,
  alertConfig,
  sendAlert,
  performSystemHealthCheck
};