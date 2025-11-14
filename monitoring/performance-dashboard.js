// Performance Dashboard Configuration
const performanceDashboardConfig = {
  // Real-time Performance Monitoring
  realTime: {
    enabled: true,
    refreshInterval: 5000, // 5 seconds
    metrics: {
      server: [
        {
          name: 'requests_per_second',
          query: 'rate(requests_total[1m])',
          unit: 'req/s',
          threshold: { warning: 100, critical: 200 }
        },
        {
          name: 'response_time_p95',
          query: 'histogram_quantile(0.95, rate(response_time_seconds_bucket[1m]))',
          unit: 'ms',
          threshold: { warning: 1000, critical: 2000 }
        },
        {
          name: 'error_rate',
          query: 'rate(requests_total{status_code=~"5.."}[1m]) / rate(requests_total[1m]) * 100',
          unit: '%',
          threshold: { warning: 5, critical: 10 }
        },
        {
          name: 'cpu_usage',
          query: 'cpu_usage_percent',
          unit: '%',
          threshold: { warning: 80, critical: 90 }
        },
        {
          name: 'memory_usage',
          query: 'memory_heap_used_bytes / memory_heap_total_bytes * 100',
          unit: '%',
          threshold: { warning: 85, critical: 95 }
        }
      ],
      client: [
        {
          name: 'page_load_time',
          source: 'frontend',
          unit: 'ms',
          threshold: { warning: 3000, critical: 5000 }
        },
        {
          name: 'core_web_vitals',
          source: 'frontend',
          unit: 'score',
          metrics: ['LCP', 'FID', 'CLS'],
          threshold: { good: 75, poor: 50 }
        },
        {
          name: 'network_requests',
          source: 'frontend',
          unit: 'req',
          threshold: { warning: 50, critical: 100 }
        }
      ]
    }
  },

  // Performance Trends Dashboard
  trends: {
    enabled: true,
    timeRange: '24h',
    granularity: '5m',
    metrics: {
      responseTime: {
        queries: [
          'response_time_seconds{quantile="0.5"}',
          'response_time_seconds{quantile="0.95"}',
          'response_time_seconds{quantile="0.99"}'
        ],
        title: 'Response Time Trends',
        description: 'P50, P95, and P99 response times over time'
      },
      throughput: {
        queries: [
          'requests_total',
          'rate(requests_total[5m])'
        ],
        title: 'Request Throughput',
        description: 'Total requests and request rate'
      },
      errorRates: {
        queries: [
          'rate(requests_total{status_code=~"4.."}[5m]) / rate(requests_total[5m]) * 100',
          'rate(requests_total{status_code=~"5.."}[5m]) / rate(requests_total[5m]) * 100'
        ],
        title: 'Error Rate Trends',
        description: '4xx and 5xx error rates over time'
      },
      resourceUsage: {
        queries: [
          'cpu_usage_percent',
          'memory_heap_used_bytes / memory_heap_total_bytes * 100',
          'database_connections_active'
        ],
        title: 'Resource Usage Trends',
        description: 'CPU, memory, and database connection usage'
      }
    }
  },

  // Application Performance Dashboard
  application: {
    enabled: true,
    panels: [
      {
        title: 'API Response Times by Endpoint',
        type: 'table',
        query: 'topk(10, response_time_seconds{endpoint!=""}) by (endpoint, method)',
        threshold: { good: 200, warning: 1000, critical: 2000 }
      },
      {
        title: 'Slow Database Queries',
        type: 'table',
        query: 'topk(10, database_query_duration_seconds) by (query_type)',
        threshold: { good: 0.1, warning: 0.5, critical: 1.0 }
      },
      {
        title: 'Request Rate by Method',
        type: 'graph',
        query: 'sum(rate(requests_total[5m])) by (method)',
        visualization: 'bar'
      },
      {
        title: 'Error Distribution',
        type: 'pie',
        query: 'sum(requests_total{status_code=~"4.."}) by (status_code)',
        visualization: 'pie'
      }
    ]
  },

  // Infrastructure Performance Dashboard
  infrastructure: {
    enabled: true,
    panels: [
      {
        title: 'Server CPU Usage',
        type: 'graph',
        query: 'cpu_usage_percent',
        threshold: { warning: 70, critical: 85 }
      },
      {
        title: 'Memory Usage Breakdown',
        type: 'graph',
        query: 'memory_heap_used_bytes + memory_heap_total_bytes + memory_external_bytes',
        visualization: 'stacked'
      },
      {
        title: 'Database Connection Pool',
        type: 'singlestat',
        query: 'database_connections_active / database_connections_total * 100',
        unit: '%',
        threshold: { warning: 80, critical: 95 }
      },
      {
        title: 'Network I/O',
        type: 'graph',
        query: 'rate(network_bytes_total[5m])',
        visualization: 'dual'
      }
    ]
  },

  // User Experience Dashboard
  userExperience: {
    enabled: true,
    panels: [
      {
        title: 'Core Web Vitals',
        type: 'gauge',
        metrics: ['LCP', 'FID', 'CLS'],
        threshold: {
          LCP: { good: 2500, poor: 4000 },
          FID: { good: 100, poor: 300 },
          CLS: { good: 0.1, poor: 0.25 }
        }
      },
      {
        title: 'Page Load Time Distribution',
        type: 'histogram',
        query: 'page_load_duration_seconds',
        bins: 20
      },
      {
        title: 'Frontend Errors',
        type: 'table',
        query: 'frontend_errors_total by (error_type, page)',
        threshold: { warning: 10, critical: 50 }
      },
      {
        title: 'User Journey Performance',
        type: 'flow',
        steps: ['navigation', 'dom_ready', 'page_load', 'resources_loaded']
      }
    ]
  }
};

// Performance Alert Configuration
const performanceAlertConfig = {
  // Response Time Alerts
  responseTime: {
    p95: {
      threshold: 1000, // milliseconds
      duration: 300, // 5 minutes
      severity: 'warning',
      description: 'P95 response time is above 1 second',
      actions: ['slack', 'email']
    },
    p99: {
      threshold: 2000, // milliseconds
      duration: 180, // 3 minutes
      severity: 'critical',
      description: 'P99 response time is above 2 seconds',
      actions: ['slack', 'email', 'sms']
    },
    slowestEndpoint: {
      threshold: 5000, // milliseconds
      duration: 60, // 1 minute
      severity: 'critical',
      description: 'Slowest endpoint taking more than 5 seconds',
      actions: ['slack', 'email', 'pagerduty']
    }
  },

  // Error Rate Alerts
  errorRate: {
    warning: {
      threshold: 5, // percentage
      duration: 300, // 5 minutes
      severity: 'warning',
      description: 'Error rate is above 5%',
      actions: ['slack']
    },
    critical: {
      threshold: 10, // percentage
      duration: 180, // 3 minutes
      severity: 'critical',
      description: 'Error rate is above 10%',
      actions: ['slack', 'email', 'sms']
    }
  },

  // Resource Usage Alerts
  resourceUsage: {
    cpu: {
      warning: {
        threshold: 80, // percentage
        duration: 600, // 10 minutes
        severity: 'warning',
        description: 'CPU usage is above 80%',
        actions: ['slack']
      },
      critical: {
        threshold: 95, // percentage
        duration: 300, // 5 minutes
        severity: 'critical',
        description: 'CPU usage is above 95%',
        actions: ['slack', 'email']
      }
    },
    memory: {
      warning: {
        threshold: 85, // percentage
        duration: 600, // 10 minutes
        severity: 'warning',
        description: 'Memory usage is above 85%',
        actions: ['slack']
      },
      critical: {
        threshold: 95, // percentage
        duration: 300, // 5 minutes
        severity: 'critical',
        description: 'Memory usage is above 95%',
        actions: ['slack', 'email', 'sms']
      }
    },
    database: {
      connections: {
        threshold: 80, // percentage of max connections
        duration: 300, // 5 minutes
        severity: 'warning',
        description: 'Database connection pool usage is high',
        actions: ['slack']
      },
      slowQueries: {
        threshold: 5, // count of slow queries
        duration: 60, // 1 minute
        severity: 'warning',
        description: 'More than 5 slow database queries detected',
        actions: ['slack']
      }
    }
  },

  // Frontend Performance Alerts
  frontend: {
    coreWebVitals: {
      lcp: {
        threshold: 2500, // milliseconds
        duration: 300, // 5 minutes
        severity: 'warning',
        description: 'Largest Contentful Paint is above 2.5 seconds',
        actions: ['slack']
      },
      fid: {
        threshold: 100, // milliseconds
        duration: 300, // 5 minutes
        severity: 'warning',
        description: 'First Input Delay is above 100ms',
        actions: ['slack']
      },
      cls: {
        threshold: 0.1, // score
        duration: 300, // 5 minutes
        severity: 'warning',
        description: 'Cumulative Layout Shift is above 0.1',
        actions: ['slack']
      }
    },
    pageLoad: {
      threshold: 5000, // milliseconds
      duration: 300, // 5 minutes
      severity: 'critical',
      description: 'Page load time is above 5 seconds',
      actions: ['slack', 'email']
    },
    errors: {
      threshold: 10, // errors per minute
      duration: 60, // 1 minute
      severity: 'critical',
      description: 'High frontend error rate detected',
      actions: ['slack', 'email', 'sms']
    }
  },

  // Traffic Alerts
  traffic: {
    low: {
      threshold: 1, // requests per second
      duration: 600, // 10 minutes
      severity: 'warning',
      description: 'Very low traffic detected - possible service issue',
      actions: ['slack']
    },
    high: {
      threshold: 1000, // requests per second
      duration: 60, // 1 minute
      severity: 'warning',
      description: 'High traffic detected - possible attack or surge',
      actions: ['slack']
    }
  }
};

// Alert Escalation Policies
const alertEscalation = {
  // Immediate escalation for critical issues
  immediate: {
    delay: 0,
    channels: ['slack', 'email', 'sms'],
    repeatInterval: 900 // 15 minutes
  },
  
  // Gradual escalation for warnings
  gradual: {
    steps: [
      {
        delay: 0,
        channels: ['slack'],
        repeatInterval: 1800 // 30 minutes
      },
      {
        delay: 1800, // 30 minutes
        channels: ['email'],
        repeatInterval: 3600 // 1 hour
      },
      {
        delay: 3600, // 1 hour
        channels: ['sms'],
        repeatInterval: 7200 // 2 hours
      }
    ]
  },
  
  // Performance-specific escalation
  performance: {
    thresholdBreach: {
      delay: 300, // 5 minutes
      channels: ['slack'],
      repeatInterval: 600 // 10 minutes
    },
    persistent: {
      delay: 900, // 15 minutes
      channels: ['slack', 'email'],
      repeatInterval: 1800 // 30 minutes
    },
    critical: {
      delay: 60, // 1 minute
      channels: ['slack', 'email', 'sms', 'pagerduty'],
      repeatInterval: 300 // 5 minutes
    }
  }
};

// Performance Budget Configuration
const performanceBudget = {
  // Core Web Vitals Budget
  coreWebVitals: {
    LCP: {
      good: 2500,
      poor: 4000,
      unit: 'ms',
      weight: 0.4
    },
    FID: {
      good: 100,
      poor: 300,
      unit: 'ms',
      weight: 0.3
    },
    CLS: {
      good: 0.1,
      poor: 0.25,
      unit: 'score',
      weight: 0.3
    }
  },
  
  // Page Load Budget
  pageLoad: {
    firstContentfulPaint: {
      good: 1800,
      poor: 3000,
      unit: 'ms'
    },
    largestContentfulPaint: {
      good: 2500,
      poor: 4000,
      unit: 'ms'
    },
    timeToInteractive: {
      good: 3000,
      poor: 5000,
      unit: 'ms'
    }
  },
  
  // Resource Size Budget
  resourceSize: {
    javascript: {
      budget: 170, // KB
      warning: 200,
      critical: 250
    },
    css: {
      budget: 80, // KB
      warning: 100,
      critical: 120
    },
    images: {
      budget: 500, // KB
      warning: 600,
      critical: 800
    },
    total: {
      budget: 1000, // KB
      warning: 1200,
      critical: 1500
    }
  },
  
  // API Response Time Budget
  apiResponse: {
    p50: {
      good: 200,
      poor: 500,
      unit: 'ms'
    },
    p95: {
      good: 1000,
      poor: 2000,
      unit: 'ms'
    },
    p99: {
      good: 2000,
      poor: 5000,
      unit: 'ms'
    }
  }
};

// Alert Rule Engine
class PerformanceAlertEngine {
  constructor() {
    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.escalationTimers = new Map();
  }

  // Check if an alert should be triggered
  checkMetric(metricName, value, threshold, duration) {
    const now = Date.now();
    const alertKey = `${metricName}_${threshold.severity}`;
    
    if (this.shouldTriggerAlert(value, threshold)) {
      if (!this.activeAlerts.has(alertKey)) {
        // New alert - start tracking
        this.activeAlerts.set(alertKey, {
          metric: metricName,
          value,
          threshold,
          startTime: now,
          triggeredAt: now
        });
        
        this.triggerAlert(alertKey);
      }
    } else {
      // Metric is within threshold - clear alert if exists
      if (this.activeAlerts.has(alertKey)) {
        this.clearAlert(alertKey);
      }
    }
  }

  shouldTriggerAlert(value, threshold) {
    if (threshold.direction === 'above') {
      return value > threshold.value;
    } else {
      return value < threshold.value;
    }
  }

  triggerAlert(alertKey) {
    const alert = this.activeAlerts.get(alertKey);
    if (!alert) return;

    console.log(`🚨 ALERT: ${alert.metric} - ${alert.threshold.severity}`);

    // Send to configured channels
    alert.threshold.actions.forEach(action => {
      this.sendAlert(action, alert);
    });

    // Start escalation if configured
    if (alert.threshold.escalation) {
      this.startEscalation(alertKey, alert);
    }

    // Record in history
    this.alertHistory.push({
      ...alert,
      type: 'triggered',
      timestamp: Date.now()
    });
  }

  clearAlert(alertKey) {
    const alert = this.activeAlerts.get(alertKey);
    if (!alert) return;

    console.log(`✅ CLEARED: ${alert.metric} alert`);

    // Stop escalation
    this.stopEscalation(alertKey);

    // Record in history
    this.alertHistory.push({
      ...alert,
      type: 'cleared',
      timestamp: Date.now()
    });

    // Remove from active alerts
    this.activeAlerts.delete(alertKey);
  }

  sendAlert(channel, alert) {
    // Implementation for different channels
    switch (channel) {
      case 'slack':
        this.sendSlackAlert(alert);
        break;
      case 'email':
        this.sendEmailAlert(alert);
        break;
      case 'sms':
        this.sendSMSAlert(alert);
        break;
      case 'pagerduty':
        this.sendPagerDutyAlert(alert);
        break;
    }
  }

  sendSlackAlert(alert) {
    // Slack webhook implementation
    console.log(`📱 Slack Alert: ${alert.metric} - ${alert.threshold.severity}`);
  }

  sendEmailAlert(alert) {
    // Email implementation
    console.log(`📧 Email Alert: ${alert.metric} - ${alert.threshold.severity}`);
  }

  sendSMSAlert(alert) {
    // SMS implementation
    console.log(`📱 SMS Alert: ${alert.metric} - ${alert.threshold.severity}`);
  }

  sendPagerDutyAlert(alert) {
    // PagerDuty implementation
    console.log(`🚨 PagerDuty Alert: ${alert.metric} - ${alert.threshold.severity}`);
  }

  startEscalation(alertKey, alert) {
    const escalationPolicy = alertEscalation[alert.threshold.escalation];
    if (!escalationPolicy) return;

    if (escalationPolicy.immediate) {
      // Immediate escalation
      setTimeout(() => {
        if (this.activeAlerts.has(alertKey)) {
          escalationPolicy.channels.forEach(channel => {
            this.sendAlert(channel, alert);
          });
        }
      }, escalationPolicy.delay);
    } else if (escalationPolicy.steps) {
      // Step-by-step escalation
      escalationPolicy.steps.forEach(step => {
        setTimeout(() => {
          if (this.activeAlerts.has(alertKey)) {
            step.channels.forEach(channel => {
              this.sendAlert(channel, alert);
            });
          }
        }, step.delay);
      });
    }
  }

  stopEscalation(alertKey) {
    if (this.escalationTimers.has(alertKey)) {
      this.escalationTimers.get(alertKey).forEach(timer => {
        clearTimeout(timer);
      });
      this.escalationTimers.delete(alertKey);
    }
  }

  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory(limit = 100) {
    return this.alertHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
}

module.exports = {
  performanceDashboardConfig,
  performanceAlertConfig,
  performanceBudget,
  alertEscalation,
  PerformanceAlertEngine
};