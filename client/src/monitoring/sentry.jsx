// Client-side Sentry error monitoring configuration
import * as Sentry from '@sentry/react';
import { browserTracingIntegration } from '@sentry/react';
import React from 'react';

// Initialize Sentry for client-side error tracking
export function initClientSentry() {
  // Only initialize in production or if explicitly enabled
  const shouldInit = import.meta.env.PROD || import.meta.env.VITE_SENTRY_ENABLED === 'true';
  
  if (!shouldInit || !import.meta.env.VITE_SENTRY_DSN) {
    console.log('⚠️ Sentry client monitoring disabled');
    return;
  }

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',
    
    // Enable automatic instrumentation
    integrations: [
      browserTracingIntegration({
        // Performance monitoring
        tracePropagationTargets: ['localhost', /^https:\/\/yourdomain\.com\/api/],
      }),
    ],
    
    // Performance monitoring settings
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    
    // Error filtering for client-side issues
    beforeSend(event) {
      // Filter out non-critical browser errors
      if (event.exception) {
        const error = event.exception.values?.[0];
        
        // Filter out common non-critical client errors
        if (error?.type === 'ChunkLoadError' || 
            error?.value?.includes('Loading chunk') ||
            error?.value?.includes('Failed to fetch module')) {
          return null;
        }
        
        // Filter out network errors that are expected
        if (error?.value?.includes('Network Error') && 
            event.request?.url?.includes('/api/health')) {
          return null;
        }
        
        // Filter out development-specific errors
        if (!import.meta.env.PROD && 
            (error?.value?.includes('DevTools') || 
             error?.value?.includes('Hot Module Replacement'))) {
          return null;
        }
      }
      
      return event;
    },
    
    // Enhanced context
    initialScope: {
      tags: {
        component: 'client',
        framework: 'react',
        environment: import.meta.env.MODE
      },
      extra: {
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        url: window.location.href,
        referrer: document.referrer
      }
    }
  });
  
  console.log('✅ Client-side Sentry error tracking initialized');
}

// Error fallback component
const ErrorFallback = ({ error, resetError }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
      <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <div className="mt-4 text-center">
        <h3 className="text-lg font-medium text-gray-900">
          Something went wrong
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          We're sorry, but an unexpected error occurred. Our team has been notified.
        </p>
        <div className="mt-4">
          <button
            onClick={resetError}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  </div>
);

// Custom error boundary component with Sentry integration
export const ErrorBoundary = Sentry.withErrorBoundary(
  ({ children }) => children,
  {
    fallback: ErrorFallback,
    showDialog: import.meta.env.DEV, // Show dialog in development
    dialogOptions: {
      title: 'Application Error',
      subtitle: 'An unexpected error occurred. Please report this issue.',
      showReportDialog: true,
    }
  }
);

// Utility function to manually report errors
export function reportClientError(error, context = {}) {
  Sentry.withScope((scope) => {
    // Add custom context
    Object.keys(context).forEach(key => {
      scope.setContext(key, context[key]);
    });
    
    // Add user context if available
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.id) {
      scope.setUser({
        id: user.id,
        email: user.email,
        username: user.username
      });
    }
    
    scope.setTag('source', 'manual_report');
    Sentry.captureException(error);
  });
}

// Performance monitoring utilities
export function trackPageLoad(pageName) {
  Sentry.addBreadcrumb({
    message: `Page loaded: ${pageName}`,
    category: 'navigation',
    level: 'info',
    data: {
      page: pageName,
      timestamp: Date.now()
    }
  });
}

export function trackApiCall(url, method = 'GET', duration) {
  Sentry.addBreadcrumb({
    message: `API call: ${method} ${url}`,
    category: 'http',
    level: 'info',
    data: {
      url,
      method,
      duration
    }
  });
}

// User interaction tracking
export function trackUserAction(action, component, details = {}) {
  Sentry.addBreadcrumb({
    message: `User action: ${action}`,
    category: 'user',
    level: 'info',
    data: {
      action,
      component,
      ...details
    }
  });
}

// Custom hook for error reporting in components
export function useErrorReporting() {
  const reportError = (error, context = {}) => {
    reportClientError(error, {
      component: 'useErrorReporting',
      ...context
    });
  };
  
  const captureMessage = (message, level = 'info') => {
    Sentry.captureMessage(message, level);
  };
  
  return { reportError, captureMessage };
}