/**
 * Performance monitoring middleware
 * Tracks API response times, error rates, and system health metrics
 * Collects data for admin dashboard analytics
 */

// Initialize global metrics object
if (!global.performanceMetrics) {
  global.performanceMetrics = {
    requestCount: 0,
    totalResponseTime: 0,
    avgResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    errorCount: 0,
    successCount: 0,
    statusCodeDistribution: {},
    endpointMetrics: {},
    uptimeMs: Date.now(),
  };
}

/**
 * Performance monitoring middleware
 * Measures response time for each request
 * Tracks errors, success, and status codes
 */
const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;

  // Override send to capture response details
  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Update global metrics
    global.performanceMetrics.requestCount += 1;
    global.performanceMetrics.totalResponseTime += responseTime;
    global.performanceMetrics.avgResponseTime = global.performanceMetrics.totalResponseTime / global.performanceMetrics.requestCount;
    global.performanceMetrics.minResponseTime = Math.min(global.performanceMetrics.minResponseTime, responseTime);
    global.performanceMetrics.maxResponseTime = Math.max(global.performanceMetrics.maxResponseTime, responseTime);

    // Track by status code
    if (!global.performanceMetrics.statusCodeDistribution[statusCode]) {
      global.performanceMetrics.statusCodeDistribution[statusCode] = 0;
    }
    global.performanceMetrics.statusCodeDistribution[statusCode] += 1;

    // Track errors and successes
    if (statusCode >= 400) {
      global.performanceMetrics.errorCount += 1;
    } else {
      global.performanceMetrics.successCount += 1;
    }

    // Track per-endpoint metrics
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    if (!global.performanceMetrics.endpointMetrics[endpoint]) {
      global.performanceMetrics.endpointMetrics[endpoint] = {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        errors: 0,
      };
    }
    global.performanceMetrics.endpointMetrics[endpoint].count += 1;
    global.performanceMetrics.endpointMetrics[endpoint].totalTime += responseTime;
    global.performanceMetrics.endpointMetrics[endpoint].avgTime = global.performanceMetrics.endpointMetrics[endpoint].totalTime / global.performanceMetrics.endpointMetrics[endpoint].count;

    if (statusCode >= 400) {
      global.performanceMetrics.endpointMetrics[endpoint].errors += 1;
    }

    // Log slow requests (> 1000ms)
    if (responseTime > 1000) {
      console.warn(`[SLOW REQUEST] ${endpoint} took ${responseTime}ms`);
    }

    // Add custom header
    res.set('X-Response-Time', `${responseTime}ms`);

    // Call original send
    return originalSend.call(this, data);
  };

  next();
};

/**
 * Get performance report
 */
const getPerformanceReport = () => {
  const metrics = global.performanceMetrics;

  return {
    summary: {
      totalRequests: metrics.requestCount,
      averageResponseTime: metrics.avgResponseTime.toFixed(2) + 'ms',
      minResponseTime: metrics.minResponseTime === Infinity ? 'N/A' : metrics.minResponseTime + 'ms',
      maxResponseTime: metrics.maxResponseTime + 'ms',
      successRate: metrics.requestCount > 0 ? ((metrics.successCount / metrics.requestCount) * 100).toFixed(2) + '%' : 'N/A',
      errorCount: metrics.errorCount,
      errorRate: metrics.requestCount > 0 ? ((metrics.errorCount / metrics.requestCount) * 100).toFixed(2) + '%' : 'N/A',
      uptime: formatUptime(Date.now() - metrics.uptimeMs),
    },
    statusCodes: metrics.statusCodeDistribution,
    endpoints: Object.entries(metrics.endpointMetrics).map(([endpoint, stats]) => ({
      name: endpoint,
      requests: stats.count,
      avgResponseTime: stats.avgTime.toFixed(2) + 'ms',
      errorCount: stats.errors,
      errorRate: stats.count > 0 ? ((stats.errors / stats.count) * 100).toFixed(2) + '%' : '0%',
    })),
  };
};

/**
 * Reset performance metrics (admin only)
 */
const resetMetrics = () => {
  global.performanceMetrics = {
    requestCount: 0,
    totalResponseTime: 0,
    avgResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    errorCount: 0,
    successCount: 0,
    statusCodeDistribution: {},
    endpointMetrics: {},
    uptimeMs: Date.now(),
  };
};

/**
 * Check system health based on metrics
 */
const getHealthStatus = () => {
  const metrics = global.performanceMetrics;

  const checks = {
    avgResponseTime: metrics.avgResponseTime < 300, // Target: < 300ms
    errorRate: metrics.errorCount / Math.max(metrics.requestCount, 1) < 0.05, // Target: < 5%
    maxResponseTime: metrics.maxResponseTime < 5000, // Max: < 5s
  };

  const allHealthy = Object.values(checks).every(v => v === true);

  return {
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date(),
    checks,
    metrics: {
      avgResponseTime: metrics.avgResponseTime.toFixed(2) + 'ms',
      errorRate: ((metrics.errorCount / Math.max(metrics.requestCount, 1)) * 100).toFixed(2) + '%',
      maxResponseTime: metrics.maxResponseTime + 'ms',
    },
  };
};

/**
 * Format uptime from milliseconds
 */
function formatUptime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

module.exports = {
  performanceMonitor,
  getPerformanceReport,
  resetMetrics,
  getHealthStatus,
  formatUptime,
};
