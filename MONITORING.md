# Application Monitoring Setup Guide

This document provides comprehensive instructions for setting up and using the monitoring system for the MERN Blog application.

## 📋 Table of Contents

1. [Health Check Endpoints](#health-check-endpoints)
2. [Uptime Monitoring](#uptime-monitoring)
3. [Error Tracking with Sentry](#error-tracking-with-sentry)
4. [Client-Side Monitoring](#client-side-monitoring)
5. [Monitoring Dashboards](#monitoring-dashboards)
6. [Alert Configuration](#alert-configuration)
7. [Environment Variables](#environment-variables)
8. [API Reference](#api-reference)

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
