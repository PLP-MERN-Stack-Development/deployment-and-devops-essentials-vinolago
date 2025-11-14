# Application Monitoring & Performance Setup Guide

This document provides comprehensive instructions for setting up and using the monitoring and performance system for the MERN Blog application.

## 📋 Table of Contents

1. [Health Check Endpoints](#health-check-endpoints)
2. [Uptime Monitoring](#uptime-monitoring)
3. [Error Tracking with Sentry](#error-tracking-with-sentry)
4. [Client-Side Monitoring](#client-side-monitoring)
5. [Performance Monitoring](#performance-monitoring)
6. [Monitoring Dashboards](#monitoring-dashboards)
7. [Alert Configuration](#alert-configuration)
8. [Environment Variables](#environment-variables)
9. [API Reference](#api-reference)

## 🔍 Health Check Endpoints

The application provides multiple health check endpoints for different monitoring purposes:

### Available Endpoints

| Endpoint           | Purpose                        | Expected Response                |
| ------------------ | ------------------------------ | -------------------------------- |
| `/health`          | Overall application health     | 200 if healthy, 503 if unhealthy |
| `/health/live`     | Kubernetes liveness probe      | 200 if process is running        |
| `/health/ready`    | Kubernetes readiness probe     | 200 if ready to serve traffic    |
| `/health/detailed` | Detailed dependency checks     | 200 if all checks pass           |
| `/health/db`       | Database-specific health check | 200 if database is responsive    |
| `/metrics`         | Prometheus-style metrics       | 200 with metrics data            |

### Response Examples

#### `/health` Response

```json
{
  "status": "healthy",
  "timestamp": "2025-11-14T15:16:31.164Z",
  "uptime": {
    "process": 1234.567,
    "system": 5678.901
  },
  "environment": "production",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "redis": "not_configured",
    "external_apis": "unknown"
  },
  "performance": {
    "memory": {
      "rss": "45MB",
      "heapUsed": "32MB",
      "heapTotal": "64MB",
      "heapPercentage": 50,
      "external": "2MB"
    },
    "cpu": {
      "usage": { "user": 12345, "system": 6789 },
      "loadAverage": [0.5, 0.3, 0.2]
    },
    "system": {
      "totalMemory": "8192MB",
      "freeMemory": "4096MB",
      "usedMemoryPercent": 50,
      "platform": "linux",
      "arch": "x64",
      "cpuCount": 4
    }
  },
  "checks": {
    "memory": "healthy",
    "uptime": "healthy"
  }
}
```

#### `/health/live` Response

```json
{
  "status": "alive",
  "timestamp": "2025-11-14T15:16:31.164Z",
  "pid": 1234,
  "uptime": 1234.567
}
```

#### `/health/ready` Response

```json
{
  "status": "ready",
  "timestamp": "2025-11-14T15:16:31.164Z",
  "database": "connected"
}
```

## 📊 Uptime Monitoring

### Better Uptime Integration

Set up external uptime monitoring using Better Uptime:

1. **Configure Heartbeat URL**

   ```bash
   BETTER_UPTIME_HEARTBEAT_URL=https://betteruptime.com/api/v1/heartbeat/your-heartbeat-id
   BETTER_UPTIME_API_KEY=your-api-key
   ```

2. **Configure Webhook for Alerts**
   ```bash
   BETTER_UPTIME_WEBHOOK_URL=https://betteruptime.com/webhook/your-webhook-id
   ```

### Monitoring Services

The application supports multiple monitoring services:

- **Better Uptime**: Heartbeat monitoring and alerts
- **Pingdom**: Synthetic monitoring from multiple locations
- **Render**: Built-in health check integration

### Health Check Thresholds

| Metric            | Warning   | Critical   |
| ----------------- | --------- | ---------- |
| Response Time     | 5 seconds | 10 seconds |
| Memory Usage      | 90%       | 95%        |
| Error Rate        | 10%       | 20%        |
| Database Response | 2 seconds | 5 seconds  |

## 🐛 Error Tracking with Sentry

### Server-Side Sentry Setup

1. **Install Sentry SDK**

   ```bash
   npm install @sentry/node @sentry/profiling-node
   ```

2. **Configure Environment Variables**

   ```bash
   SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
   SENTRY_ENVIRONMENT=production
   SENTRY_ORG=your-org
   SENTRY_PROJECT=your-project
   ```

3. **Initialize Sentry in Application**
   ```javascript
   const { initSentry } = require("./middleware/sentry");
   initSentry();
   ```

### Enhanced Sentry Features

- **Smart Error Filtering**: Automatically filters out non-critical errors
- **Performance Monitoring**: Tracks transaction performance
- **Custom Context**: Adds system and application context
- **Release Tracking**: Associates errors with application versions

### Error Categories Filtered

- Chunk loading errors in production
- Bot/crawler 404s on static assets
- Health check monitoring requests
- Development-specific warnings
- Network errors on health endpoints

## 🖥️ Client-Side Monitoring

### React Application Sentry Integration

1. **Install Client Sentry**

   ```bash
   npm install @sentry/react
   ```

2. **Initialize in Main Application**

   ```javascript
   import { initClientSentry, ErrorBoundary } from "./monitoring/sentry";

   // Initialize Sentry
   initClientSentry();

   // Wrap app with error boundary
   <ErrorBoundary>
     <App />
   </ErrorBoundary>;
   ```

3. **Configure Environment Variables**
   ```bash
   VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
   VITE_SENTRY_ENABLED=true
   VITE_APP_VERSION=1.0.0
   ```

### Client Monitoring Features

- **React Error Boundary**: Catches and reports React component errors
- **Performance Tracing**: Tracks React component rendering performance
- **User Context**: Automatically includes user information when available
- **Custom Error Reporting**: Utility functions for manual error reporting

### Usage Examples

```javascript
import { useErrorReporting, reportClientError } from "./monitoring/sentry";

// In a React component
const { reportError, captureMessage } = useErrorReporting();

try {
  // Your code here
} catch (error) {
  reportError(error, { component: "MyComponent" });
}

// Manual error reporting
reportClientError(new Error("Custom error"), {
  action: "user_login",
  userId: user.id,
});

// Track user actions
import { trackUserAction } from "./monitoring/sentry";
trackUserAction("button_click", "LoginForm", { buttonId: "login" });
```

## 📈 Performance Monitoring

### Server-Side Performance Monitoring

The application includes a comprehensive performance monitoring system that tracks:

#### Key Metrics Tracked

- **Request Performance**: Response times, throughput, error rates
- **Resource Usage**: CPU, memory, network I/O
- **Database Performance**: Query times, connection pool status
- **API Endpoint Performance**: Per-endpoint metrics and slow query detection

#### Features

- Real-time performance tracking
- Historical data retention
- Slow request identification
- Database query monitoring
- Performance alert thresholds

#### API Endpoints

| Endpoint                         | Description                    | Response |
| -------------------------------- | ------------------------------ | -------- |
| `/api/performance/stats`         | Overall performance statistics | 200      |
| `/api/performance/requests`      | Request performance data       | 200      |
| `/api/performance/slow-requests` | Slow requests (>1s)            | 200      |
| `/api/performance/errors`        | Error requests                 | 200      |
| `/api/performance/endpoints`     | Per-endpoint metrics           | 200      |
| `/api/performance/database`      | Database performance           | 200      |
| `/api/performance/resources`     | Resource usage metrics         | 200      |
| `/api/performance/realtime`      | Real-time performance data     | 200      |

### Client-Side Performance Monitoring

Comprehensive frontend performance tracking including:

#### Core Web Vitals

- **LCP (Largest Contentful Paint)**: Measures loading performance
- **FID (First Input Delay)**: Measures interactivity
- **CLS (Cumulative Layout Shift)**: Measures visual stability
- **FCP (First Contentful Paint)**: Measures user-perceived speed
- **TTFB (Time to First Byte)**: Measures server response time

#### Additional Metrics

- **Component Render Time**: Tracks React component performance
- **Network Request Performance**: Monitors API calls and resources
- **Memory Usage**: JavaScript heap monitoring
- **Long Task Detection**: Identifies performance bottlenecks

#### Usage Examples

```javascript
import {
  frontendPerformanceMonitor,
  usePerformanceTracking,
  trackMetric,
} from "./monitoring/performance";

// Track custom metric
trackMetric("user_action_duration", 250, { action: "form_submission" });

// In a React component
function MyComponent() {
  const performanceTracker = usePerformanceTracking("MyComponent");

  useEffect(() => {
    // Component logic
    performanceTracker.endRender();
  }, []);

  return <div>My Component</div>;
}

// Get full performance metrics
const metrics = frontendPerformanceMonitor.getFullMetrics();
console.log("Performance metrics:", metrics);
```

### Performance Monitoring Features

#### Request Tracking

```javascript
// Automatically tracks all requests through middleware
app.use(performanceMonitor.requestMiddleware());
```

#### Database Query Monitoring

```javascript
// Track database queries
const start = Date.now();
await db.query("SELECT * FROM users");
performanceMonitor.trackDatabaseQuery(
  "SELECT * FROM users",
  Date.now() - start
);
```

#### Real-Time Monitoring

```javascript
// Get real-time performance data
const realtime = await fetch("/api/performance/realtime");
const data = await realtime.json();
```

### Performance Budgets

The system includes performance budgets with automatic alerting:

| Metric                | Good    | Warning    | Critical |
| --------------------- | ------- | ---------- | -------- |
| **Response Time P95** | < 200ms | 200-1000ms | > 1000ms |
| **Response Time P99** | < 500ms | 500-2000ms | > 2000ms |
| **Error Rate**        | < 1%    | 1-5%       | > 5%     |
| **CPU Usage**         | < 50%   | 50-80%     | > 80%    |
| **Memory Usage**      | < 70%   | 70-85%     | > 85%    |

### Core Web Vitals Standards

| Vital   | Good    | Needs Improvement | Poor    |
| ------- | ------- | ----------------- | ------- |
| **LCP** | ≤ 2.5s  | 2.5-4.0s          | > 4.0s  |
| **FID** | ≤ 100ms | 100-300ms         | > 300ms |
| **CLS** | ≤ 0.1   | 0.1-0.25          | > 0.25  |
| **FCP** | ≤ 1.8s  | 1.8-3.0s          | > 3.0s  |
| **INP** | ≤ 200ms | 200-500ms         | > 500ms |

### Dashboard Configurations

The performance monitoring system includes pre-configured dashboards:

#### Real-Time Dashboard

- Request rate and throughput
- Response time percentiles (P50, P95, P99)
- Error rate monitoring
- Resource usage tracking

#### Trends Dashboard

- 24-hour performance trends
- Response time patterns
- Error rate evolution
- Resource usage over time

#### Application Dashboard

- API endpoint performance
- Database query analysis
- Slow request identification
- Error distribution analysis

#### Infrastructure Dashboard

- CPU and memory usage
- Network I/O monitoring
- Database connection pools
- System resource trends

## 📈 Monitoring Dashboards

### Supported Dashboard Platforms

#### Grafana Dashboard

```javascript
// Configure Grafana integration
GRAFANA_ENABLED=true
GRAFANA_URL=https://your-grafana-instance.com
GRAFANA_API_KEY=your-api-key
```

#### Sentry Dashboard

Built-in dashboard with:

- Error trends and patterns
- Performance metrics
- Release tracking
- User impact analysis

#### Better Uptime Dashboard

- Uptime metrics
- Response time monitoring
- Geographic performance
- Alert history

### Custom Dashboard Metrics

| Metric Category | Metrics                                    | Purpose                |
| --------------- | ------------------------------------------ | ---------------------- |
| Business        | Active users, Posts created, Registrations | Business KPIs          |
| Technical       | Response times, Error rates, Throughput    | Performance monitoring |
| Infrastructure  | CPU, Memory, Disk, Database connections    | Resource monitoring    |

## 🚨 Alert Configuration

### Alert Channels

#### Email Alerts

```bash
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_RECIPIENTS=admin@example.com,dev@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

#### Slack Alerts

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
SLACK_CHANNEL=#alerts
SLACK_USERNAME=Monitoring Bot
```

#### SMS Alerts (via Twilio)

```bash
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1234567890
ALERT_PHONE_NUMBERS=+1234567890,+0987654321
```

### Alert Rules

#### Critical Alerts

- Service unavailable for > 1 minute
- 99th percentile response time > 5 seconds
- Error rate > 10%
- Memory usage > 95%

#### Warning Alerts

- 95th percentile response time > 2 seconds
- Error rate > 2%
- Memory usage > 85%
- CPU usage > 80%

### Escalation Policies

#### Immediate (Critical)

- 0 minutes: Email, Slack, SMS
- 5 minutes: PagerDuty

#### Gradual (Warning)

- 0 minutes: Slack
- 15 minutes: Email
- 30 minutes: SMS

## 🔧 Environment Variables

### Server-Side Variables

```bash
# Sentry Configuration
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project

# Monitoring Services
BETTER_UPTIME_HEARTBEAT_URL=https://betteruptime.com/api/v1/heartbeat/your-id
BETTER_UPTIME_API_KEY=your-api-key
BETTER_UPTIME_WEBHOOK_URL=https://betteruptime.com/webhook/your-id

PINGDOM_API_KEY=your-pingdom-api-key
PINGDOM_EMAIL=your-email@example.com
PINGDOM_PASSWORD=your-password
PINGDOM_CHECK_ID=your-check-id

# Dashboard Configuration
GRAFANA_ENABLED=true
GRAFANA_URL=https://your-grafana.com
GRAFANA_API_KEY=your-api-key

# Alert Channels
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_RECIPIENTS=admin@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
SLACK_CHANNEL=#alerts
SLACK_USERNAME=Monitoring Bot

# SMS Alerts (Twilio)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1234567890
ALERT_PHONE_NUMBERS=+1234567890

# PagerDuty
PAGERDUTY_INTEGRATION_KEY=your-integration-key
PAGERDUTY_SERVICE_KEY=your-service-key

# Application URLs
API_BASE_URL=https://your-api-url.com
FRONTEND_URL=https://your-frontend-url.com
```

### Client-Side Variables

```bash
# Client Sentry Configuration
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_SENTRY_ENABLED=true
VITE_APP_VERSION=1.0.0
```

## 📡 API Reference

### Health Check Endpoints

#### GET `/health`

Main health check endpoint with basic system information.

**Response Codes:**

- `200`: Application is healthy
- `429`: Application is experiencing issues (memory usage > 90%)
- `503`: Application is unhealthy (memory usage > 95%)

#### GET `/health/live`

Kubernetes-style liveness probe.

**Response Codes:**

- `200`: Process is running

#### GET `/health/ready`

Kubernetes-style readiness probe.

**Response Codes:**

- `200`: Application is ready to serve traffic
- `503`: Application is not ready

#### GET `/health/detailed`

Comprehensive health check with dependency status.

**Response Codes:**

- `200`: All dependencies are healthy
- `503`: One or more dependencies are unhealthy

#### GET `/health/db`

Database-specific health check.

**Response Codes:**

- `200`: Database is responsive
- `503`: Database is not available
- `500`: Error checking database

#### GET `/metrics`

Prometheus-style metrics endpoint.

**Response:**

```json
{
  "timestamp": "2025-11-14T15:16:31.164Z",
  "uptime_seconds": 1234.567,
  "memory_rss_bytes": 47185920,
  "memory_heap_bytes": 33554432,
  "cpu_user_seconds": 123456,
  "cpu_system_seconds": 78901,
  "active_connections": 1,
  "environment": "production"
}
```

### Monitoring Utilities

#### Performance Tracking

```javascript
const { withPerformanceTracking } = require("./middleware/sentry");

const trackedFunction = withPerformanceTracking("database_query", async () => {
  return await db.findUser();
});
```

#### Custom Metrics

```javascript
const { trackMetric } = require("./middleware/sentry");

trackMetric("user_login_duration", 150, { user_type: "premium" });
```

#### Error Reporting

```javascript
const { reportError } = require("./middleware/sentry");

try {
  // Some operation
} catch (error) {
  reportError(error, { user_id: user.id, action: "login" });
}
```

### Performance API Endpoints

#### GET `/api/performance/stats`

Overall performance statistics including request rates, response times, and resource usage.

**Response:**

```json
{
  "success": true,
  "data": {
    "uptime": 3600,
    "requestRate": 15.5,
    "totalRequests": 55800,
    "errorRate": 0.02,
    "averageResponseTime": 245.6,
    "responseTimePercentiles": {
      "p50": 156,
      "p95": 892,
      "p99": 1456
    },
    "resources": {
      "cpu": { "usage": 45.2, "history": [...] },
      "memory": { "heapPercentage": 67, "history": [...] },
      "network": { "bytesIn": 1024000, "bytesOut": 2048000 }
    }
  },
  "timestamp": "2025-11-14T15:16:31.164Z"
}
```

#### GET `/api/performance/requests`

Detailed request performance data with filtering and pagination support.

**Query Parameters:**

- `limit`: Number of results to return (default: 50)
- `sortBy`: Field to sort by (default: timestamp)
- `sortOrder`: Sort direction (asc/desc)
- `statusCode`: Filter by status code
- `method`: Filter by HTTP method
- `path`: Filter by URL path

#### GET `/api/performance/slow-requests`

Retrieve slow requests above the specified threshold.

**Query Parameters:**

- `limit`: Maximum number of results (default: 20)
- `threshold`: Minimum duration in milliseconds (default: 1000)

#### GET `/api/performance/endpoints`

Per-endpoint performance metrics including request counts and response times.

**Response:**

```json
{
  "success": true,
  "data": {
    "endpoints": [
      {
        "path": "/api/posts",
        "method": "GET",
        "totalRequests": 1245,
        "averageDuration": 156.7,
        "statusCodes": { "200": 1200, "404": 45 },
        "slowest": 2134,
        "fastest": 23
      }
    ],
    "summary": {
      "totalEndpoints": 12,
      "totalRequests": 55800,
      "averageResponseTime": 245.6,
      "slowestEndpoint": "/api/posts",
      "fastestEndpoint": "/health"
    }
  }
}
```

#### GET `/api/performance/database`

Database performance metrics including query times and connection pool status.

#### GET `/api/performance/resources`

System resource usage metrics including CPU, memory, and network statistics.

#### GET `/api/performance/realtime`

Real-time performance data for monitoring dashboards.

**Response:**

```json
{
  "success": true,
  "data": {
    "timestamp": "2025-11-14T15:16:31.164Z",
    "status": "healthy",
    "alerts": [],
    "metrics": {
      "requestsPerSecond": 15.5,
      "errorRate": 0.02,
      "responseTime": 245.6,
      "cpuUsage": 45.2,
      "memoryUsage": 67
    }
  }
}
```

#### POST `/api/performance/reset`

Reset all performance metrics (requires authentication).

**Body:**

```json
{
  "apiKey": "your-monitoring-api-key"
}
```

## 🔍 Troubleshooting

### Common Issues

1. **Health Check Fails**

   - Check database connectivity
   - Monitor memory usage
   - Review application logs

2. **Sentry Not Receiving Events**

   - Verify DSN is correct
   - Check environment variables
   - Review error filtering rules

3. **Monitoring Alerts Not Working**
   - Verify webhook URLs
   - Check alert channel configuration
   - Test alert escalation policies

### Log Locations

- Application logs: `server/logs/` (if configured)
- Health check logs: Application console
- Sentry logs: Sentry dashboard
- Monitor logs: Respective monitoring service dashboards

## 📚 Additional Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Better Uptime Documentation](https://docs.betteruptime.com/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Kubernetes Health Checks](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)

---

This monitoring system provides comprehensive visibility into your application's health, performance, and error patterns, enabling proactive issue detection and resolution.
