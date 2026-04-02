const Order = require('../models/Order');
const Negotiation = require('../models/Negotiation');
const User = require('../models/User');
const Inventory = require('../models/Inventory');

/**
 * Dashboard statistics - Overview of system health and activity
 * Calculates KPIs: order metrics, negotiation stats, revenue, conflicts, etc.
 */
const getDashboardStats = async (req, res) => {
  try {
    // Verify admin authorization
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can access dashboard' });
    }

    // Fetch all statistics in parallel
    const [orderStats, negotiationStats, userStats, conflictStats, inventoryStats, revenueStats] = await Promise.all([
      getOrderStats(),
      getNegotiationStats(),
      getUserStats(),
      getConflictStats(),
      getInventoryStats(),
      getRevenueStats(),
    ]);

    res.json({
      dashboard: {
        timestamp: new Date(),
        orders: orderStats,
        negotiations: negotiationStats,
        users: userStats,
        conflicts: conflictStats,
        inventory: inventoryStats,
        revenue: revenueStats,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Order statistics - Performance and health metrics
 */
const getOrderStats = async () => {
  try {
    const total = await Order.countDocuments();
    const byState = await Order.aggregate([
      {
        $group: {
          _id: '$orderState',
          count: { $sum: 1 },
        },
      },
    ]);

    const byPaymentState = await Order.aggregate([
      {
        $group: {
          _id: '$paymentState',
          count: { $sum: 1 },
        },
      },
    ]);

    const withConflicts = await Order.countDocuments({ hasConflict: true });
    const delivered = await Order.countDocuments({ orderState: 'DELIVERED' });
    const rejected = await Order.countDocuments({ orderState: 'REJECTED' });

    // Average delivery time (delivered orders only)
    const deliveryTimes = await Order.aggregate([
      {
        $match: { orderState: 'DELIVERED', deliveredAt: { $exists: true } },
      },
      {
        $project: {
          deliveryDays: {
            $divide: [{ $subtract: ['$deliveredAt', '$createdAt'] }, 1000 * 60 * 60 * 24],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgDeliveryDays: { $avg: '$deliveryDays' },
        },
      },
    ]);

    const stateMap = {};
    byState.forEach(s => {
      stateMap[s._id] = s.count;
    });

    const paymentMap = {};
    byPaymentState.forEach(p => {
      paymentMap[p._id] = p.count;
    });

    return {
      total,
      byState: stateMap,
      byPaymentState: paymentMap,
      withConflicts,
      delivered,
      rejected,
      conversionRate: total > 0 ? ((delivered / total) * 100).toFixed(2) + '%' : '0%',
      conflictRate: total > 0 ? ((withConflicts / total) * 100).toFixed(2) + '%' : '0%',
      avgDeliveryDays: deliveryTimes[0]?.avgDeliveryDays?.toFixed(2) || 'N/A',
    };
  } catch (error) {
    console.error('Order stats error:', error);
    return { error: error.message };
  }
};

/**
 * Negotiation statistics - Engagement metrics
 */
const getNegotiationStats = async () => {
  try {
    const total = await Negotiation.countDocuments();
    const byState = await Negotiation.aggregate([
      {
        $group: {
          _id: '$state',
          count: { $sum: 1 },
        },
      },
    ]);

    const accepted = await Negotiation.countDocuments({ state: 'ACCEPTED' });
    const expired = await Negotiation.countDocuments({ state: 'EXPIRED' });
    const active = await Negotiation.countDocuments({ state: 'ACTIVE' });

    const stateMap = {};
    byState.forEach(s => {
      stateMap[s._id] = s.count;
    });

    return {
      total,
      byState: stateMap,
      accepted,
      expired,
      active,
      acceptanceRate: total > 0 ? ((accepted / total) * 100).toFixed(2) + '%' : '0%',
      activePercentage: total > 0 ? ((active / total) * 100).toFixed(2) + '%' : '0%',
    };
  } catch (error) {
    console.error('Negotiation stats error:', error);
    return { error: error.message };
  }
};

/**
 * User statistics - Community metrics
 */
const getUserStats = async () => {
  try {
    const total = await User.countDocuments();
    const byRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);

    const verified = await User.countDocuments({ isVerified: true });
    const active = await User.countDocuments({ isActive: true });

    const roleMap = {};
    byRole.forEach(r => {
      roleMap[r._id] = r.count;
    });

    return {
      total,
      byRole: roleMap,
      verified,
      verificationRate: total > 0 ? ((verified / total) * 100).toFixed(2) + '%' : '0%',
      active,
      activeRate: total > 0 ? ((active / total) * 100).toFixed(2) + '%' : '0%',
    };
  } catch (error) {
    console.error('User stats error:', error);
    return { error: error.message };
  }
};

/**
 * Conflict statistics - Issue tracking
 */
const getConflictStats = async () => {
  try {
    const total = await Order.countDocuments({ hasConflict: true });
    const byType = await Order.aggregate([
      {
        $match: { hasConflict: true },
      },
      {
        $group: {
          _id: '$conflictResolution',
          count: { $sum: 1 },
        },
      },
    ]);

    const byReconciliation = await Order.aggregate([
      {
        $match: { hasConflict: true },
      },
      {
        $group: {
          _id: '$reconciliationStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    const typeMap = {};
    byType.forEach(t => {
      typeMap[t._id] = t.count;
    });

    const reconciliationMap = {};
    byReconciliation.forEach(r => {
      reconciliationMap[r._id] = r.count;
    });

    return {
      total,
      byType: typeMap,
      byReconciliation: reconciliationMap,
      unresolvedCount: await Order.countDocuments({ hasConflict: true, reconciliationStatus: 'PENDING' }),
    };
  } catch (error) {
    console.error('Conflict stats error:', error);
    return { error: error.message };
  }
};

/**
 * Inventory statistics - Stock health
 */
const getInventoryStats = async () => {
  try {
    const total = await Inventory.countDocuments();
    const totalStock = await Inventory.aggregate([
      {
        $group: {
          _id: null,
          totalAvailable: { $sum: '$availableStock' },
          totalReserved: { $sum: '$reservedStock' },
          totalSold: { $sum: '$soldStock' },
        },
      },
    ]);

    // Low stock items (< 1000 units)
    const lowStock = await Inventory.countDocuments({ availableStock: { $lt: 1000 } });

    // Out of stock
    const outOfStock = await Inventory.countDocuments({ availableStock: 0 });

    const stats = totalStock[0] || { totalAvailable: 0, totalReserved: 0, totalSold: 0 };

    return {
      totalSkus: total,
      totalAvailableStock: stats.totalAvailable,
      totalReservedStock: stats.totalReserved,
      totalSoldStock: stats.totalSold,
      lowStockCount: lowStock,
      outOfStockCount: outOfStock,
    };
  } catch (error) {
    console.error('Inventory stats error:', error);
    return { error: error.message };
  }
};

/**
 * Revenue statistics - Financial metrics
 */
const getRevenueStats = async () => {
  try {
    const totalRevenue = await Order.aggregate([
      {
        $match: { orderState: 'DELIVERED', paymentState: 'PAID' },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const pendingRevenue = await Order.aggregate([
      {
        $match: { paymentState: 'PENDING' },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
        },
      },
    ]);

    // Monthly revenue (last 12 months)
    const monthlyRevenue = await Order.aggregate([
      {
        $match: { orderState: 'DELIVERED', paymentState: 'PAID' },
      },
      {
        $group: {
          _id: {
            year: { $year: '$deliveredAt' },
            month: { $month: '$deliveredAt' },
          },
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.year': -1, '_id.month': -1 },
      },
      {
        $limit: 12,
      },
    ]);

    return {
      totalRevenue: totalRevenue[0]?.total || 0,
      totalOrders: totalRevenue[0]?.count || 0,
      avgOrderValue: totalRevenue[0]?.total && totalRevenue[0]?.count ? (totalRevenue[0].total / totalRevenue[0].count).toFixed(2) : 0,
      pendingRevenue: pendingRevenue[0]?.total || 0,
      monthlyRevenue,
    };
  } catch (error) {
    console.error('Revenue stats error:', error);
    return { error: error.message };
  }
};

/**
 * Get list of conflicted orders for admin review
 */
const getConflictList = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can view conflicts' });
    }

    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = { hasConflict: true };
    if (status) {
      filter.reconciliationStatus = status;
    }

    const conflicts = await Order.find(filter)
      .populate('farmerId', 'firstName lastName email')
      .populate('ownerId', 'firstName lastName email')
      .populate('productId', 'name basePrice')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ updatedAt: -1 });

    const total = await Order.countDocuments(filter);

    res.json({
      conflicts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get conflict list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get system health - Performance and stability metrics
 */
const getSystemHealth = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can view system health' });
    }

    // Get from global metrics (set by middleware)
    const metrics = global.performanceMetrics || {
      requestCount: 0,
      avgResponseTime: 0,
      errorCount: 0,
      uptimeMs: 0,
    };

    res.json({
      health: {
        status: metrics.errorCount < 10 ? 'healthy' : 'degraded',
        timestamp: new Date(),
        metrics,
      },
    });
  } catch (error) {
    console.error('System health error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getDashboardStats,
  getConflictList,
  getSystemHealth,
  getOrderStats,
  getNegotiationStats,
  getUserStats,
  getConflictStats,
  getInventoryStats,
  getRevenueStats,
};
