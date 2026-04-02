const Order = require('../models/Order');
const Negotiation = require('../models/Negotiation');
const { SellerAnalytics } = require('../models/Phase6Models');

/**
 * Calculate seller analytics and trust score
 * Trust score factors:
 *   - Order fulfillment rate (40%)
 *   - Payment reliability (30%)
 *   - Conflict resolution (20%)
 *   - Negotiation acceptance (10%)
 */
const calculateSellerAnalytics = async (sellerId) => {
  try {
    // Get seller's orders
    const orders = await Order.find({ ownerId: sellerId });
    const totalOrders = orders.length;
    const deliveredOrders = orders.filter(o => o.orderState === 'DELIVERED').length;
    const rejectedOrders = orders.filter(o => o.orderState === 'REJECTED').length;
    const conflictedOrders = orders.filter(o => o.hasConflict).length;
    const refundedOrders = orders.filter(o => o.reconciliationStatus === 'REFUNDED').length;

    // Calculate fulfillment rate
    const fulfillmentRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;

    // Calculate average fulfillment time
    const deliveredWithTime = orders.filter(o => o.orderState === 'DELIVERED' && o.deliveredAt);
    const avgFulfillmentDays = deliveredWithTime.length > 0
      ? deliveredWithTime.reduce((sum, o) => {
        const days = (o.deliveredAt - o.createdAt) / (1000 * 60 * 60 * 24);
        return sum + days;
      }, 0) / deliveredWithTime.length
      : 0;

    // Calculate payment metrics
    const paidOrders = orders.filter(o => o.paymentState === 'PAID').length;
    const paymentReliability = totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0;

    // Get seller's negotiations
    const negotiations = await Negotiation.find({ ownerId: sellerId });
    const acceptedNegotiations = negotiations.filter(n => n.state === 'ACCEPTED').length;
    const negotiationAcceptanceRate = negotiations.length > 0 ? (acceptedNegotiations / negotiations.length) * 100 : 0;

    // Calculate total revenue
    const totalRevenue = orders
      .filter(o => o.paymentState === 'PAID')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    // Calculate average order value
    const avgOrderValue = deliveredOrders > 0 ? totalRevenue / deliveredOrders : 0;

    // Calculate conflicts metric
    const conflictRate = totalOrders > 0 ? (conflictedOrders / totalOrders) * 100 : 0;

    // Calculate trust score (0-100)
    // Components:
    // - Fulfillment rate: 40% weight
    // - Payment reliability: 30% weight
    // - Low conflict rate: 20% weight
    // - Negotiation acceptance: 10% weight
    const fulfillmentScore = Math.min(fulfillmentRate, 100) * 0.4;
    const paymentScore = Math.min(paymentReliability, 100) * 0.3;
    const conflictScore = Math.max(0, (100 - conflictRate) * 0.2);
    const negotiationScore = Math.min(negotiationAcceptanceRate, 100) * 0.1;
    const trustScore = Math.round(fulfillmentScore + paymentScore + conflictScore + negotiationScore);

    // Determine trend
    const previousAnalytics = await SellerAnalytics.findOne({ sellerId });
    let reputationTrend = 'stable';
    if (previousAnalytics) {
      const scoreDifference = trustScore - previousAnalytics.trustScore;
      if (scoreDifference > 5) {
        reputationTrend = 'improving';
      } else if (scoreDifference < -5) {
        reputationTrend = 'declining';
      }
    }

    // Update or create analytics
    const analytics = await SellerAnalytics.findOneAndUpdate(
      { sellerId },
      {
        trustScore: Math.max(0, Math.min(100, trustScore)),
        totalOrdersFulfilled: deliveredOrders,
        totalOrdersRejected: rejectedOrders,
        avgFulfillmentDays: parseFloat(avgFulfillmentDays.toFixed(2)),
        fulfillmentRate: parseFloat(fulfillmentRate.toFixed(2)),
        totalReviews: conflictedOrders,
        totalNegotiations: negotiations.length,
        negotiationAcceptanceRate: parseFloat(negotiationAcceptanceRate.toFixed(2)),
        totalRevenue,
        avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
        conflictCount: conflictedOrders,
        refundCount: refundedOrders,
        reputationTrend,
        lastUpdated: new Date(),
      },
      { upsert: true, new: true },
    );

    return analytics;
  } catch (error) {
    console.error('Calculate seller analytics error:', error);
    throw error;
  }
};

/**
 * Get seller analytics (public view for other sellers)
 */
const getSellerAnalytics = async (req, res) => {
  try {
    const { sellerId } = req.params;

    const analytics = await SellerAnalytics.findOne({ sellerId })
      .populate('sellerId', 'firstName lastName email phone');

    if (!analytics) {
      return res.status(404).json({ error: 'Seller analytics not found' });
    }

    res.json({
      analytics,
    });
  } catch (error) {
    console.error('Get seller analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get seller rankings - top sellers by trust score
 */
const getSellerRankings = async (req, res) => {
  try {
    const { limit = 20, skipTrustScore = 0 } = req.query;

    const rankings = await SellerAnalytics.find({
      trustScore: { $gte: parseInt(skipTrustScore) },
    })
      .populate('sellerId', 'firstName lastName email')
      .limit(parseInt(limit))
      .sort({ trustScore: -1 });

    res.json({
      rankings,
      count: rankings.length,
    });
  } catch (error) {
    console.error('Get seller rankings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get my analytics (seller's own analytics)
 */
const getMyAnalytics = async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only sellers can view their analytics' });
    }

    // Recalculate analytics
    const analytics = await calculateSellerAnalytics(req.user.userId);

    res.json({
      analytics,
    });
  } catch (error) {
    console.error('Get my analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  calculateSellerAnalytics,
  getSellerAnalytics,
  getSellerRankings,
  getMyAnalytics,
};
