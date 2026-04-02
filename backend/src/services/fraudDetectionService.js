const Order = require('../models/Order');
const { FraudDetection } = require('../models/Phase6Models');

/**
 * Fraud Detection Module
 * Analyzes orders for suspicious behavior patterns
 */

/**
 * Analyze order for fraud risk
 * Risk factors:
 *   - High order value (30 points)
 *   - Velocity (multiple orders in short time) (25 points)
 *   - Unusual shipping pattern (20 points)
 *   - New buyer (15 points)
 *   - Payment risk (10 points)
 */
const analyzeOrderForFraud = async (orderId) => {
  try {
    const order = await Order.findById(orderId)
      .populate('farmerId')
      .populate('ownerId');

    if (!order) {
      throw new Error('Order not found');
    }

    const riskFactors = [];
    let totalRiskScore = 0;

    // Factor 1: High order value
    const avgOrderValue = await getAverageOrderValue(order.ownerId._id);
    if (order.totalAmount > avgOrderValue * 3) {
      const score = Math.min(30, (order.totalAmount / (avgOrderValue * 3)) * 30);
      riskFactors.push({
        factor: 'HIGH_ORDER_VALUE',
        score: Math.round(score),
        reason: `Order value (${order.totalAmount}) is ${(order.totalAmount / avgOrderValue).toFixed(1)}x average`,
      });
      totalRiskScore += score;
    }

    // Factor 2: Purchase velocity
    const velocityScore = await calculateVelocityRisk(order.farmerId._id);
    if (velocityScore > 0) {
      riskFactors.push({
        factor: 'HIGH_VELOCITY',
        score: Math.round(velocityScore),
        reason: 'Multiple orders made in short time window',
      });
      totalRiskScore += velocityScore;
    }

    // Factor 3: New buyer
    const accountAgeScore = calculateAccountAgeRisk(order.farmerId.createdAt);
    if (accountAgeScore > 0) {
      riskFactors.push({
        factor: 'NEW_ACCOUNT',
        score: Math.round(accountAgeScore),
        reason: `Account created ${getDaysOld(order.farmerId.createdAt)} days ago`,
      });
      totalRiskScore += accountAgeScore;
    }

    // Factor 4: Unusual shipping pattern
    const shippingScore = await analyzeShippingPattern(order.farmerId._id, order.shippingAddress);
    if (shippingScore > 0) {
      riskFactors.push({
        factor: 'UNUSUAL_SHIPPING',
        score: Math.round(shippingScore),
        reason: 'Shipping address differs from usual pattern',
      });
      totalRiskScore += shippingScore;
    }

    // Factor 5: Payment method risk
    const paymentRiskScore = analyzePaymentRisk(order);
    if (paymentRiskScore > 0) {
      riskFactors.push({
        factor: 'PAYMENT_RISK',
        score: Math.round(paymentRiskScore),
        reason: 'Payment method carries higher risk',
      });
      totalRiskScore += paymentRiskScore;
    }

    // Determine flag level
    let flag = 'LOW';
    if (totalRiskScore >= 75) {
      flag = 'CRITICAL';
    } else if (totalRiskScore >= 60) {
      flag = 'HIGH';
    } else if (totalRiskScore >= 40) {
      flag = 'MEDIUM';
    }

    // Save fraud detection record
    const fraudRecord = new FraudDetection({
      orderId,
      userId: order.farmerId._id,
      riskScore: Math.min(100, Math.round(totalRiskScore)),
      riskFactors,
      flag,
      status: 'PENDING_REVIEW',
    });

    await fraudRecord.save();

    return {
      fraudRecord,
      shouldBlock: flag === 'CRITICAL',
    };
  } catch (error) {
    console.error('Fraud analysis error:', error);
    throw error;
  }
};

/**
 * Get average order value for seller
 */
async function getAverageOrderValue(ownerId) {
  const result = await Order.aggregate([
    {
      $match: { ownerId },
    },
    {
      $group: {
        _id: null,
        avgValue: { $avg: '$totalAmount' },
      },
    },
  ]);

  return result[0]?.avgValue || 50000;
}

/**
 * Calculate velocity risk (multiple orders in short time)
 */
async function calculateVelocityRisk(farmerId) {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  const recentOrders = await Order.countDocuments({
    farmerId,
    createdAt: { $gte: thirtyMinutesAgo },
  });

  // More than 3 orders in 30 minutes = risky
  if (recentOrders > 3) {
    return Math.min(25, (recentOrders - 3) * 8);
  }

  return 0;
}

/**
 * Calculate account age risk
 */
function calculateAccountAgeRisk(createdAt) {
  const daysOld = getDaysOld(createdAt);

  if (daysOld < 1) {
    return 15; // Brand new account = full risk
  }
  if (daysOld < 7) {
    return 10; // Less than a week
  }
  if (daysOld < 30) {
    return 5; // Less than a month
  }

  return 0;
}

/**
 * Analyze shipping pattern for anomalies
 */
async function analyzeShippingPattern(farmerId, currentAddress) {
  const previousOrders = await Order.find({ farmerId })
    .select('shippingAddress')
    .limit(10)
    .sort({ createdAt: -1 });

  if (previousOrders.length === 0) {
    return 0; // No history to compare
  }

  // Check if current address matches any previous
  const hasMatching = previousOrders.some(o => {
    const addr = o.shippingAddress;
    return (
      addr.city === currentAddress.city &&
      addr.state === currentAddress.state &&
      addr.zipCode === currentAddress.zipCode
    );
  });

  return hasMatching ? 0 : 10; // Unusual address = some risk
}

/**
 * Analyze payment risk
 */
function analyzePaymentRisk(order) {
  // COD orders have no payment data yet - slightly risky
  if (order.paymentMethod === 'COD') {
    return 5;
  }

  return 0;
}

/**
 * Get days old
 */
function getDaysOld(date) {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Get fraud records for admin review
 */
const getFraudRecords = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can view fraud records' });
    }

    const { page = 1, limit = 20, flag = 'HIGH', status = 'PENDING_REVIEW' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = {};
    if (flag) filter.flag = flag;
    if (status) filter.status = status;

    const records = await FraudDetection.find(filter)
      .populate('userId', 'firstName lastName email')
      .populate('orderId', 'totalAmount orderState paymentState')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ flag: -1, createdAt: -1 });

    const total = await FraudDetection.countDocuments(filter);

    res.json({
      records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get fraud records error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Admin review fraud record
 */
const reviewFraudRecord = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can review fraud records' });
    }

    const { fraudRecordId } = req.params;
    const { decision, notes } = req.body;

    const fraudRecord = await FraudDetection.findByIdAndUpdate(
      fraudRecordId,
      {
        status: decision === 'approve' ? 'APPROVED' : 'BLOCKED',
        adminReview: {
          reviewedBy: req.user.userId,
          reviewedAt: new Date(),
          decision,
          notes,
        },
      },
      { new: true },
    );

    res.json({
      message: `Fraud record ${decision === 'approve' ? 'approved' : 'blocked'}`,
      fraudRecord,
    });
  } catch (error) {
    console.error('Review fraud record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  analyzeOrderForFraud,
  getFraudRecords,
  reviewFraudRecord,
};
