const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getDashboardStats,
  getConflictList,
  getSystemHealth,
} = require('../controllers/adminController');
const { getPerformanceReport, getHealthStatus, resetMetrics } = require('../middleware/performanceMonitor');
const { notificationQueue } = require('../services/notificationService');

// ============ Phase 5: Admin Dashboard & Monitoring ============

/**
 * Dashboard Statistics
 * Aggregated KPIs for admin overview
 */
router.get('/dashboard/stats', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    await getDashboardStats(req, res);
  } catch (error) {
    console.error('Dashboard stats route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Conflict Management
 * List and manage orders with conflicts
 */
router.get('/conflicts', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    await getConflictList(req, res);
  } catch (error) {
    console.error('Conflict list route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * System Health
 * Overall system status
 */
router.get('/system/health', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    await getSystemHealth(req, res);
  } catch (error) {
    console.error('System health route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Performance Metrics
 * Detailed performance report by endpoint
 */
router.get('/system/performance', authenticate, authorize(['ADMIN']), (req, res) => {
  const report = getPerformanceReport();
  res.json({
    performance: report,
  });
});

/**
 * Health Status Check
 * Quick health indicator
 */
router.get('/system/health-check', authenticate, authorize(['ADMIN']), (req, res) => {
  const health = getHealthStatus();
  res.json(health);
});

/**
 * Reset Performance Metrics
 * Clear accumulated metrics (admin only)
 */
router.post('/system/reset-metrics', authenticate, authorize(['ADMIN']), (req, res) => {
  resetMetrics();
  res.json({ message: 'Performance metrics reset' });
});

/**
 * Notifications - Get recent notifications
 */
router.get('/notifications', authenticate, authorize(['ADMIN']), (req, res) => {
  const { type, isRead, limit = 50 } = req.query;

  const notifications = notificationQueue.getNotifications(
    type,
    isRead ? isRead === 'true' : null,
    parseInt(limit),
  );

  res.json({
    notifications,
    stats: notificationQueue.getStats(),
  });
});

/**
 * Notifications - Mark as read
 */
router.put('/notifications/:notificationId/read', authenticate, authorize(['ADMIN']), (req, res) => {
  const notification = notificationQueue.markAsRead(req.params.notificationId);

  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  res.json({
    message: 'Notification marked as read',
    notification,
  });
});

/**
 * Notifications - Mark all as read
 */
router.put('/notifications/mark-all-read', authenticate, authorize(['ADMIN']), (req, res) => {
  notificationQueue.markAllAsRead();

  res.json({
    message: 'All notifications marked as read',
  });
});

/**
 * Notifications - Get stats
 */
router.get('/notifications/stats', authenticate, authorize(['ADMIN']), (req, res) => {
  const stats = notificationQueue.getStats();

  res.json({
    stats,
  });
});

module.exports = router;
