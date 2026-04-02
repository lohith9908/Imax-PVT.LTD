/**
 * Audit logging middleware
 * Tracks admin actions for compliance and debugging
 */

const { AuditLog } = require('../models/Phase6Models');

/**
 * Create audit log entry
 */
const auditLog = async (userId, action, resourceType, resourceId, details = {}, changes = {}, req = null) => {
  try {
    const logEntry = new AuditLog({
      userId,
      action,
      resourceType,
      resourceId,
      details,
      changes,
      ipAddress: req?.ip || 'unknown',
      userAgent: req?.get('user-agent') || 'unknown',
    });

    await logEntry.save();
    return logEntry;
  } catch (error) {
    console.error('Audit log error:', error);
    // Don't throw - audit logging should not break operations
  }
};

/**
 * Audit logging middleware
 * Automatically logs certains actions
 */
const auditMiddleware = (req, res, next) => {
  // Store original send for wrapping
  const originalSend = res.send;

  res.send = function(data) {
    // Check if this was an admin action
    if (req.user && req.user.role === 'ADMIN') {
      const method = req.method;
      const path = req.path;

      // Log specific admin actions
      if (path.includes('/admin') && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
        const action = extractActionFromPath(path, method);
        if (action) {
          setImmediate(() => {
            auditLog(
              req.user.userId,
              action,
              extractResourceType(path),
              extractResourceId(req),
              { path, method },
              {},
              req,
            );
          });
        }
      }
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Extract action from path
 */
function extractActionFromPath(path, method) {
  if (path.includes('/resolve-conflict') && method === 'PUT') {
    return 'CONFLICT_RESOLVED';
  }
  if (path.includes('/admin/system/reset-metrics') && method === 'POST') {
    return 'METRICS_RESET';
  }
  if (path.includes('/users') && method === 'POST') {
    return 'USER_CREATED';
  }
  if (path.includes('/users') && method === 'DELETE') {
    return 'USER_DELETED';
  }
  return null;
}

/**
 * Extract resource type from path
 */
function extractResourceType(path) {
  if (path.includes('/orders')) return 'Order';
  if (path.includes('/users')) return 'User';
  if (path.includes('/products')) return 'Product';
  if (path.includes('/negotiations')) return 'Negotiation';
  return 'System';
}

/**
 * Extract resource ID from request
 */
function extractResourceId(req) {
  return req.params.id || req.params.orderId || req.params.userId || null;
}

/**
 * Get audit logs - admin only
 */
const getAuditLogs = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can view audit logs' });
    }

    const { page = 1, limit = 50, action, userId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = {};
    if (action) filter.action = action;
    if (userId) filter.userId = userId;

    const logs = await AuditLog.find(filter)
      .populate('userId', 'firstName lastName email role')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await AuditLog.countDocuments(filter);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  auditLog,
  auditMiddleware,
  getAuditLogs,
};
