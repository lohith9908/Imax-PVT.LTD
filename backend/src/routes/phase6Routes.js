const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getSellerAnalytics,
  getSellerRankings,
  getMyAnalytics,
} = require('../controllers/sellerAnalyticsController');
const {
  createWebhook,
  getWebhooks,
  updateWebhook,
  deleteWebhook,
} = require('../services/webhookService');
const {
  getFraudRecords,
  reviewFraudRecord,
} = require('../services/fraudDetectionService');
const {
  getAuditLogs,
} = require('../middleware/auditLogger');

// ============ Phase 6: Analytics & Advanced Features ============

/**
 * Seller Analytics
 */

// Get public seller analytics (anyone can view)
router.get('/analytics/sellers/:sellerId', authenticate, async (req, res) => {
  try {
    await getSellerAnalytics(req, res);
  } catch (error) {
    console.error('Get seller analytics route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get top seller rankings
router.get('/analytics/rankings', authenticate, async (req, res) => {
  try {
    await getSellerRankings(req, res);
  } catch (error) {
    console.error('Get rankings route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get my seller analytics (seller only)
router.get('/analytics/me', authenticate, authorize(['OWNER']), async (req, res) => {
  try {
    await getMyAnalytics(req, res);
  } catch (error) {
    console.error('Get my analytics route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Webhook Management
 */

// Create webhook
router.post('/webhooks', authenticate, authorize(['OWNER']), async (req, res) => {
  try {
    await createWebhook(req, res);
  } catch (error) {
    console.error('Create webhook route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get webhooks
router.get('/webhooks', authenticate, authorize(['OWNER']), async (req, res) => {
  try {
    await getWebhooks(req, res);
  } catch (error) {
    console.error('Get webhooks route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update webhook
router.put('/webhooks/:webhookId', authenticate, authorize(['OWNER']), async (req, res) => {
  try {
    await updateWebhook(req, res);
  } catch (error) {
    console.error('Update webhook route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete webhook
router.delete('/webhooks/:webhookId', authenticate, authorize(['OWNER']), async (req, res) => {
  try {
    await deleteWebhook(req, res);
  } catch (error) {
    console.error('Delete webhook route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Fraud Detection (Admin only)
 */

// Get fraud records for review
router.get('/fraud-records', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    await getFraudRecords(req, res);
  } catch (error) {
    console.error('Get fraud records route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Review and approve/block fraud record
router.put('/fraud-records/:fraudRecordId/review', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    await reviewFraudRecord(req, res);
  } catch (error) {
    console.error('Review fraud record route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Audit Logs (Admin only)
 */

// Get audit logs
router.get('/audit-logs', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    await getAuditLogs(req, res);
  } catch (error) {
    console.error('Get audit logs route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
