const { FraudDetection } = require('../models/Phase6Models');

/**
 * Phase 6: Fraud Detection Controller
 * Handles admin endpoints for fraud review workflow
 */

/**
 * Get fraud records for admin review
 * Filters by status, flag level, date range
 * @route GET /api/fraud-records?status=&flag=&limit=&skip=
 * @access Private (ADMIN only)
 */
async function getFraudRecords(req, res) {
  try {
    const { status = 'PENDING_REVIEW', flag, limit = 20, skip = 0 } = req.query;

    let query = { status };
    if (flag) {
      query.flag = flag;
    }

    const fraudRecords = await FraudDetection.find(query)
      .populate('orderId', 'orderDetails totalAmount createdAt')
      .populate('userId', 'name email')
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .sort({ createdAt: -1 });

    const total = await FraudDetection.countDocuments(query);

    return res.status(200).json({
      fraudRecords,
      total,
      currentPage: Math.floor(parseInt(skip) / parseInt(limit)) + 1,
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Get fraud records error:', error);
    return res.status(500).json({ error: 'Failed to retrieve fraud records' });
  }
}

/**
 * Review fraud record - approve or block order
 * Admin decision updates FraudDetection status and may trigger order cancellation
 * @route PUT /api/fraud-records/:fraudRecordId/review
 * @body { decision: 'APPROVED' | 'BLOCKED', adminNotes: string }
 * @access Private (ADMIN only)
 */
async function reviewFraudRecord(req, res) {
  try {
    const { fraudRecordId } = req.params;
    const { decision, adminNotes } = req.body;

    // Validate decision
    if (!['APPROVED', 'BLOCKED'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision. Must be APPROVED or BLOCKED' });
    }

    const fraudRecord = await FraudDetection.findById(fraudRecordId);
    if (!fraudRecord) {
      return res.status(404).json({ error: 'Fraud record not found' });
    }

    // Update fraud record
    fraudRecord.status = decision;
    fraudRecord.adminNotes = adminNotes || '';
    fraudRecord.reviewedAt = new Date();
    fraudRecord.reviewedBy = req.user._id;
    await fraudRecord.save();

    // If blocked, could trigger order cancellation/refund here
    // This would be implemented as part of order cancellation flow

    return res.status(200).json({
      message: `Fraud case ${decision}`,
      fraudRecord,
    });
  } catch (error) {
    console.error('Review fraud record error:', error);
    return res.status(500).json({ error: 'Failed to review fraud record' });
  }
}

/**
 * Get fraud statistics (summary for admin dashboard)
 * Returns counts by flag level and status
 * @route GET /api/fraud-stats
 * @access Private (ADMIN only)
 */
async function getFraudStats(req, res) {
  try {
    const stats = await FraudDetection.aggregate([
      {
        $group: {
          _id: { flag: '$flag', status: '$status' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.flag': -1, '_id.status': 1 },
      },
    ]);

    const totalCritical = await FraudDetection.countDocuments({ flag: 'CRITICAL', status: 'PENDING_REVIEW' });
    const totalPending = await FraudDetection.countDocuments({ status: 'PENDING_REVIEW' });

    return res.status(200).json({
      stats,
      totalCritical,
      totalPending,
    });
  } catch (error) {
    console.error('Get fraud stats error:', error);
    return res.status(500).json({ error: 'Failed to retrieve fraud statistics' });
  }
}

module.exports = {
  getFraudRecords,
  reviewFraudRecord,
  getFraudStats,
};
