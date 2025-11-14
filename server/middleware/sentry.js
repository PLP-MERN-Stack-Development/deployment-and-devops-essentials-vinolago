// Enhanced Sentry error tracking configuration
const Sentry = require('@sentry/node');
const { ProfilingIntegration } = require('@sentry/profiling-node');

// Initialize Sentry
function initSentry() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.npm_package_version || '1.0.0',
      serverName: process.env.HOSTNAME || 'unknown',
      integrations: [
        // Enable tracing
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app: true }),
        new Sentry.Integrations.Mongo(),
        new Sentry.Integrations.Console(),
        new ProfilingIntegration(),
      ],
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      debug: process.env.NODE_ENV === 'development',
      
      // Enhanced error filtering
      beforeSend(event) {
        // Filter out common non-critical errors in production
        if (process.env.NODE_ENV === 'production') {
          if (event.exception) {
            const error = event.exception.values[0];
            
            // Filter out client-side chunk loading errors
            if (error.type === 'ChunkLoadError' ||
                error.value?.includes('Loading chunk') ||
                error.value?.includes('Failed to fetch')) {
              return null;
            }
            
            // Filter out common bot/crawler 404s
            if (error.value?.includes('Cannot GET') &&
                (event.request?.url?.includes('robots.txt') ||
                 event.request?.url?.includes('favicon.ico'))) {
              return null;
            }
            
            // Filter out health check monitoring requests
            if (event.request?.url?.includes('/health') ||
                event.request?.url?.includes('/metrics')) {
              return null;
            }
            
            // Only report 5xx errors in production, filter 4xx errors
            if (event.exception.values[0].type &&
                (event.exception.values[0].type.includes('4') ||
                 event.exception.values[0].type.includes('ValidationError'))) {
              return null;
            }
          }
          
          // Filter out non-critical warning logs
          if (event.level === 'warning' && event.message) {
            const warningMessages = [
              'deprecated',
              'ExperimentalWarning',
              'DeprecationWarning'
            ];
            if (warningMessages.some(msg => event.message.includes(msg))) {
              return null;
            }
          }
        }
        return event;
      },
      
      beforeSendTransaction(event) {
        // Only send transaction data in production for performance monitoring
        if (process.env.NODE_ENV === 'development') {
          return null;
        }
        return event;
      },
      
      // Enhanced performance monitoring
      initialScope: {
        tags: {
          component: 'server',
          environment: process.env.NODE_ENV
        },
        extra: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        }
      }
    });
    
    // Custom event processors
    Sentry.addGlobalEventProcessor((event) => {
      // Add system information
      if (!event.contexts) {
        event.contexts = {};
      }
      
      event.contexts.system = {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      };
      
      return event;
    });
    
    console.log('✅ Enhanced Sentry error tracking initialized');
  } else {
    console.log('⚠️ Sentry DSN not provided, error tracking disabled');
  }
}

// Request handler that wraps all requests with Sentry
function requestHandler() {
  return Sentry.Handlers.requestHandler();
}

// Error handler that sends errors to Sentry
function errorHandler() {
  return Sentry.Handlers.errorHandler();
}

// Manual error reporting function
function reportError(error, context = {}) {
  Sentry.withScope((scope) => {
    // Add custom context
    Object.keys(context).forEach(key => {
      scope.setContext(key, context[key]);
    });
    
    // Add user context if available
    if (context.user) {
      scope.setUser({
        id: context.user.id,
        email: context.user.email,
        username: context.user.username
      });
    }
    
    Sentry.captureException(error);
  });
}

// Custom metric tracking
function trackMetric(name, value, tags = {}) {
  Sentry.addBreadcrumb({
    message: `Custom metric: ${name} = ${value}`,
    data: { value, ...tags },
    category: 'metric',
    level: 'info'
  });
}

// Performance monitoring wrapper
function withPerformanceTracking(name, fn) {
  return async (...args) => {
    const transaction = Sentry.startTransaction({
      op: name,
      name: `Performance: ${name}`,
    });
    
    try {
      const result = await fn(...args);
      
      // Add custom performance data
      transaction.setData('result', typeof result);
      transaction.setTag('success', 'true');
      
      return result;
    } catch (error) {
      transaction.setTag('success', 'false');
      throw error;
    } finally {
      transaction.finish();
    }
  };
}

module.exports = {
  initSentry,
  requestHandler,
  errorHandler,
  reportError,
  trackMetric,
  withPerformanceTracking,
  sentry: Sentry
};