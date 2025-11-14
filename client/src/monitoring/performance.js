// Frontend Performance Monitoring System
import * as Sentry from '@sentry/react';
import { trackUserAction } from './sentry';

// Core Web Vitals tracking
class WebVitals {
  constructor() {
    this.vitals = {
      LCP: null, // Largest Contentful Paint
      FID: null, // First Input Delay
      CLS: null, // Cumulative Layout Shift
      FCP: null, // First Contentful Paint
      TTFB: null, // Time to First Byte
      INP: null  // Interaction to Next Paint
    };
    this.startTime = performance.now();
    this.init();
  }

  init() {
    this.measureLCP();
    this.measureFID();
    this.measureCLS();
    this.measureFCP();
    this.measureTTFB();
    this.measureINP();
  }

  measureLCP() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.vitals.LCP = lastEntry.startTime;
      this.reportVital('LCP', lastEntry.startTime);
    });
    observer.observe({ entryTypes: ['largest-contentful-paint'] });
  }

  measureFID() {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.vitals.FID = entry.processingStart - entry.startTime;
        this.reportVital('FID', this.vitals.FID);
      }
    });
    observer.observe({ entryTypes: ['first-input'] });
  }

  measureCLS() {
    let clsScore = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsScore += entry.value;
        }
      }
      this.vitals.CLS = clsScore;
      this.reportVital('CLS', clsScore);
    });
    observer.observe({ entryTypes: ['layout-shift'] });
  }

  measureFCP() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        this.vitals.FCP = fcpEntry.startTime;
        this.reportVital('FCP', fcpEntry.startTime);
      }
    });
    observer.observe({ entryTypes: ['paint'] });
  }

  measureTTFB() {
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation) {
      this.vitals.TTFB = navigation.responseStart - navigation.requestStart;
      this.reportVital('TTFB', this.vitals.TTFB);
    }
  }

  measureINP() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        this.vitals.INP = entry.processingStart - entry.startTime;
        this.reportVital('INP', this.vitals.INP);
      }
    });
    observer.observe({ entryTypes: ['event'] });
  }

  reportVital(name, value) {
    // Send to Sentry for monitoring
    Sentry.addBreadcrumb({
      message: `Web Vital: ${name} = ${value}ms`,
      category: 'performance',
      level: 'info',
      data: {
        vital: name,
        value: Math.round(value * 100) / 100,
        rating: this.getRating(name, value)
      }
    });

    // Log if critical
    const rating = this.getRating(name, value);
    if (rating === 'poor') {
      console.warn(`🚨 Poor ${name}: ${value}ms`);
    }
  }

  getRating(name, value) {
    const thresholds = {
      LCP: { good: 2500, poor: 4000 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      FCP: { good: 1800, poor: 3000 },
      TTFB: { good: 800, poor: 1800 },
      INP: { good: 200, poor: 500 }
    };

    const threshold = thresholds[name];
    if (!threshold) return 'unknown';

    return value <= threshold.good ? 'good' : value >= threshold.poor ? 'poor' : 'needs-improvement';
  }

  getAllVitals() {
    return this.vitals;
  }

  getAverageScore() {
    const scores = Object.values(this.vitals).filter(score => score !== null);
    if (scores.length === 0) return 0;

    const ratings = scores.map(value => {
      // Convert vitals to normalized scores (0-100)
      if (value <= 1800) return 100; // Good
      if (value <= 3000) return 75; // Needs improvement
      return 25; // Poor
    });

    return ratings.reduce((a, b) => a + b, 0) / ratings.length;
  }
}

// Page Load Performance Tracking
class PagePerformance {
  constructor() {
    this.pageMetrics = {
      navigation: null,
      resourceTiming: [],
      paintTiming: [],
      customMetrics: {}
    };
    this.init();
  }

  init() {
    // Monitor navigation timing
    this.captureNavigationTiming();
    this.captureResourceTiming();
    this.capturePaintTiming();
    this.monitorPageVisibility();
  }

  captureNavigationTiming() {
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation) {
        this.pageMetrics.navigation = {
          // DNS lookup
          dnsTime: navigation.domainLookupEnd - navigation.domainLookupStart,
          // TCP connection
          tcpTime: navigation.connectEnd - navigation.connectStart,
          // SSL handshake
          sslTime: navigation.connectEnd - navigation.secureConnectionStart,
          // TTFB
          ttfb: navigation.responseStart - navigation.requestStart,
          // Content download
          downloadTime: navigation.responseEnd - navigation.responseStart,
          // DOM processing
          domProcessing: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          // Page load
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
          // Total time
          totalTime: navigation.loadEventEnd - navigation.navigationStart
        };

        this.reportMetric('page_load', this.pageMetrics.navigation.totalTime);
      }
    });
  }

  captureResourceTiming() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        const resource = {
          name: entry.name,
          type: entry.initiatorType,
          size: entry.transferSize,
          duration: entry.duration,
          startTime: entry.startTime
        };

        this.pageMetrics.resourceTiming.push(resource);

        // Report slow resources
        if (entry.duration > 1000) {
          console.warn(`🚨 Slow resource: ${entry.name} (${entry.duration}ms)`);
        }
      });
    });
    observer.observe({ entryTypes: ['resource'] });
  }

  capturePaintTiming() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        const paint = {
          name: entry.name,
          startTime: entry.startTime
        };
        this.pageMetrics.paintTiming.push(paint);
      });
    });
    observer.observe({ entryTypes: ['paint'] });
  }

  monitorPageVisibility() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.reportMetric('page_hidden', performance.now());
      } else {
        this.reportMetric('page_visible', performance.now());
      }
    });
  }

  reportMetric(name, value) {
    this.pageMetrics.customMetrics[name] = {
      value,
      timestamp: Date.now()
    };

    // Send to Sentry
    Sentry.addBreadcrumb({
      message: `Page metric: ${name}`,
      category: 'performance',
      level: 'info',
      data: { metric: name, value }
    });
  }

  getMetrics() {
    return this.pageMetrics;
  }
}

// React Component Performance Tracking
class ComponentPerformance {
  constructor() {
    this.renderTimes = new Map();
    this.componentMetrics = new Map();
  }

  // HOC for measuring component render time
  withPerformanceTracking(WrappedComponent, componentName) {
    return class PerformanceWrapper extends WrappedComponent {
      constructor(props) {
        super(props);
        this.componentName = componentName || WrappedComponent.name;
        this.renderStart = performance.now();
      }

      componentDidMount() {
        if (super.componentDidMount) {
          super.componentDidMount();
        }
        this.measureRender('mount');
      }

      componentDidUpdate(prevProps, prevState) {
        if (super.componentDidUpdate) {
          super.componentDidUpdate(prevProps, prevState);
        }
        this.measureRender('update');
      }

      componentWillUnmount() {
        if (super.componentWillUnmount) {
          super.componentWillUnmount();
        }
        this.measureRender('unmount');
        this.reportComponentMetrics();
      }

      measureRender(type) {
        const renderEnd = performance.now();
        const renderTime = renderEnd - this.renderStart;
        
        if (!this.renderTimes.has(type)) {
          this.renderTimes.set(type, []);
        }
        this.renderTimes.get(type).push(renderTime);

        // Report slow renders
        if (renderTime > 16) { // 16ms = 60fps threshold
          console.warn(`🚨 Slow ${this.componentName} ${type}: ${renderTime}ms`);
          trackUserAction('slow_render', this.componentName, {
            type,
            renderTime,
            props: this.getPropsSummary()
          });
        }
      }

      getPropsSummary() {
        try {
          return Object.keys(this.props).reduce((summary, key) => {
            const value = this.props[key];
            summary[key] = typeof value === 'object' ? 
              `${typeof value} with ${Object.keys(value).length} keys` : 
              String(value).substring(0, 50);
            return summary;
          }, {});
        } catch {
          return { error: 'Could not serialize props' };
        }
      }

      reportComponentMetrics() {
        const metrics = {};
        this.renderTimes.forEach((times, type) => {
          metrics[type] = {
            average: times.reduce((a, b) => a + b) / times.length,
            count: times.length,
            max: Math.max(...times),
            min: Math.min(...times)
          };
        });

        this.componentMetrics.set(this.componentName, {
          metrics,
          finalRender: performance.now() - this.renderStart
        });

        // Send to Sentry
        Sentry.addBreadcrumb({
          message: `Component metrics: ${this.componentName}`,
          category: 'performance',
          level: 'info',
          data: { component: this.componentName, metrics }
        });
      }
    };
  }

  // Hook for function components
  useRenderTracking(componentName) {
    if (typeof window !== 'undefined' && window.performance) {
      const startTime = performance.now();
      
      return {
        endRender: () => {
          const endTime = performance.now();
          const renderTime = endTime - startTime;
          
          if (renderTime > 16) {
            console.warn(`🚨 Slow ${componentName} render: ${renderTime}ms`);
            trackUserAction('slow_render', componentName, { renderTime });
          }
          
          return renderTime;
        }
      };
    }
    
    return { endRender: () => 0 };
  }

  getAllMetrics() {
    return Object.fromEntries(this.componentMetrics);
  }
}

// Network Performance Tracking
class NetworkPerformance {
  constructor() {
    this.requests = new Map();
    this.requestCount = 0;
    this.init();
  }

  init() {
    this.interceptFetch();
    this.interceptXMLHttpRequest();
  }

  interceptFetch() {
    const originalFetch = window.fetch;
    
    window.fetch = (...args) => {
      const startTime = performance.now();
      const url = args[0];
      const options = args[1] || {};
      
      return originalFetch.apply(window, args)
        .then(response => {
          const endTime = performance.now();
          const duration = endTime - startTime;
          
          this.recordRequest({
            url: typeof url === 'string' ? url : url.url,
            method: options.method || 'GET',
            status: response.status,
            duration,
            type: 'fetch',
            success: response.ok
          });
          
          return response;
        })
        .catch(error => {
          const endTime = performance.now();
          const duration = endTime - startTime;
          
          this.recordRequest({
            url: typeof url === 'string' ? url : url.url,
            method: options.method || 'GET',
            status: 0,
            duration,
            type: 'fetch',
            success: false,
            error: error.message
          });
          
          throw error;
        });
    };
  }

  interceptXMLHttpRequest() {
    const OriginalXHR = window.XMLHttpRequest;
    
    window.XMLHttpRequest = function() {
      const xhr = new OriginalXHR();
      const startTime = performance.now();
      let url = '';
      let method = 'GET';
      
      const originalOpen = xhr.open;
      const originalSend = xhr.send;
      
      xhr.open = function(methodName, urlName, ...args) {
        method = methodName;
        url = urlName;
        return originalOpen.apply(xhr, [methodName, urlName, ...args]);
      };
      
      xhr.send = function(...args) {
        const sendStartTime = startTime;
        xhr.addEventListener('loadend', () => {
          const endTime = performance.now();
          const duration = endTime - sendStartTime;
          
          this.recordRequest({
            url,
            method,
            status: xhr.status,
            duration,
            type: 'xhr',
            success: xhr.status >= 200 && xhr.status < 300
          });
        });
        
        return originalSend.apply(xhr, args);
      };
      
      return xhr;
    };
  }

  recordRequest(requestData) {
    const requestId = `req_${this.requestCount++}`;
    this.requests.set(requestId, {
      id: requestId,
      ...requestData,
      timestamp: Date.now()
    });

    // Report slow requests
    if (requestData.duration > 5000) {
      console.warn(`🚨 Very slow request: ${requestData.method} ${requestData.url} (${requestData.duration}ms)`);
      
      trackUserAction('slow_request', 'NetworkPerformance', {
        url: requestData.url,
        method: requestData.method,
        duration: requestData.duration,
        status: requestData.status
      });
    }

    // Send to Sentry
    Sentry.addBreadcrumb({
      message: `Network request: ${requestData.method} ${requestData.url}`,
      category: 'http',
      level: requestData.success ? 'info' : 'error',
      data: {
        url: requestData.url,
        method: requestData.method,
        status: requestData.status,
        duration: Math.round(requestData.duration),
        success: requestData.success
      }
    });
  }

  getRequestMetrics() {
    const requests = Array.from(this.requests.values());
    const durations = requests.map(req => req.duration);
    
    return {
      total: requests.length,
      successful: requests.filter(req => req.success).length,
      failed: requests.filter(req => !req.success).length,
      averageDuration: durations.length > 0 ? durations.reduce((a, b) => a + b) / durations.length : 0,
      slowest: durations.length > 0 ? Math.max(...durations) : 0,
      fastest: durations.length > 0 ? Math.min(...durations) : 0,
      recent: requests.slice(-10).reverse()
    };
  }
}

// Main Performance Monitor Class
class FrontendPerformanceMonitor {
  constructor() {
    this.webVitals = new WebVitals();
    this.pagePerformance = new PagePerformance();
    this.componentPerformance = new ComponentPerformance();
    this.networkPerformance = new NetworkPerformance();
    this.customMetrics = new Map();
    
    this.init();
  }

  init() {
    // Monitor long tasks
    this.monitorLongTasks();
    
    // Monitor memory usage (if available)
    this.monitorMemoryUsage();
    
    // Report initial metrics after page load
    window.addEventListener('load', () => {
      setTimeout(() => {
        this.reportInitialMetrics();
      }, 1000);
    });
  }

  monitorLongTasks() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          console.warn(`🚨 Long task detected: ${entry.duration}ms`);
          
          trackUserAction('long_task', 'PerformanceMonitor', {
            duration: entry.duration,
            startTime: entry.startTime
          });
        });
      });
      observer.observe({ entryTypes: ['longtask'] });
    }
  }

  monitorMemoryUsage() {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = performance.memory;
        this.customMetrics.set('memory', {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
          timestamp: Date.now()
        });
      }, 30000); // Every 30 seconds
    }
  }

  reportInitialMetrics() {
    const webVitals = this.webVitals.getAllVitals();
    const pageMetrics = this.pagePerformance.getMetrics();
    const networkMetrics = this.networkPerformance.getRequestMetrics();
    
    Sentry.addBreadcrumb({
      message: 'Initial performance metrics',
      category: 'performance',
      level: 'info',
      data: {
        webVitals,
        network: networkMetrics,
        pageMetrics: pageMetrics.navigation
      }
    });
  }

  // Public API
  trackCustomMetric(name, value, tags = {}) {
    this.customMetrics.set(name, {
      value,
      tags,
      timestamp: Date.now()
    });

    Sentry.addBreadcrumb({
      message: `Custom metric: ${name} = ${value}`,
      category: 'performance',
      level: 'info',
      data: { metric: name, value, ...tags }
    });
  }

  getFullMetrics() {
    return {
      webVitals: this.webVitals.getAllVitals(),
      webVitalsScore: this.webVitals.getAverageScore(),
      pagePerformance: this.pagePerformance.getMetrics(),
      networkPerformance: this.networkPerformance.getRequestMetrics(),
      componentPerformance: this.componentPerformance.getAllMetrics(),
      customMetrics: Object.fromEntries(this.customMetrics),
      timestamp: Date.now()
    };
  }

  // Helper methods for React components
  withComponentTracking(componentName) {
    return this.componentPerformance.withPerformanceTracking.bind(this.componentPerformance);
  }

  useComponentTracking(componentName) {
    return this.componentPerformance.useRenderTracking(componentName);
  }
}

// Create and export singleton instance
const frontendPerformanceMonitor = new FrontendPerformanceMonitor();

export {
  FrontendPerformanceMonitor,
  frontendPerformanceMonitor,
  WebVitals,
  PagePerformance,
  ComponentPerformance,
  NetworkPerformance
};

// Export React hooks for easy use
export const usePerformanceTracking = (componentName) => {
  return frontendPerformanceMonitor.useComponentTracking(componentName);
};

export const trackMetric = (name, value, tags) => {
  frontendPerformanceMonitor.trackCustomMetric(name, value, tags);
};