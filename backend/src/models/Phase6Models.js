const mongoose = require('mongoose');

// Metrics History - persistent storage of performance metrics over time
const metricsHistorySchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    // Overall metrics
    totalRequests: Number,
    avgResponseTime: Number,
    minResponseTime: Number,
    maxResponseTime: Number,
    errorCount: Number,
    successCount: Number,
    errorRate: Number,
    successRate: Number,
    // Per-endpoint metrics
    endpointMetrics: [
      {
        name: String,
        requests: Number,
        avgResponseTime: Number,
        errorCount: Number,
        errorRate: Number,
      },
    ],
    // Status code distribution
    statusCodeDistribution: {
      type: Map,
      of: Number,
    },
    // System info
    uptime: Number,
    memoryUsage: Number,
    cpuUsage: Number,
  },
  { timestamps: true },
);

// TTL index: auto-delete records older than 30 days
metricsHistorySchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

// Audit Log - admin activity tracking
const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        'CONFLICT_RESOLVED',
        'USER_CREATED',
        'USER_DELETED',
        'USER_SUSPENDED',
        'PRODUCT_APPROVED',
        'PRODUCT_REJECTED',
        'METRICS_RESET',
        'SYSTEM_CONFIG_CHANGED',
        'ADMIN_IMPERSONATION',
      ],
      required: true,
      index: true,
    },
    resourceType: String, // Order, Negotiation, User, Product, etc.
    resourceId: mongoose.Schema.Types.ObjectId,
    details: mongoose.Schema.Types.Mixed,
    changes: {
      before: mongoose.Schema.Types.Mixed,
      after: mongoose.Schema.Types.Mixed,
    },
    ipAddress: String,
    userAgent: String,
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILURE'],
      default: 'SUCCESS',
    },
    errorMessage: String,
  },
  { timestamps: true },
);

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });

// Webhook Configuration - for external integrations
const webhookSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
    },
    events: [
      {
        type: String,
        enum: [
          'order.created',
          'order.updated',
          'order.delivered',
          'payment.received',
          'negotiation.created',
          'negotiation.accepted',
          'conflict.reported',
          'conflict.resolved',
        ],
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    headers: {
      type: Map,
      of: String,
    },
    retryPolicy: {
      maxRetries: { type: Number, default: 3 },
      retryDelayMs: { type: Number, default: 5000 },
    },
    lastTriggeredAt: Date,
    failureCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    secret: String, // HMAC verification
  },
  { timestamps: true },
);

webhookSchema.index({ ownerId: 1, isActive: 1 });

// Seller Analytics - aggregated seller performance
const sellerAnalyticsSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    // Trust score: 0-100
    trustScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    // Performance metrics
    totalOrdersFulfilled: { type: Number, default: 0 },
    totalOrdersRejected: { type: Number, default: 0 },
    avgFulfillmentDays: { type: Number, default: 0 },
    fulfillmentRate: { type: Number, default: 0 }, // percentage
    avgRating: { type: Number, default: 5, min: 1, max: 5 },
    totalReviews: { type: Number, default: 0 },
    // Payment metrics
    totalRevenue: { type: Number, default: 0 },
    avgOrderValue: { type: Number, default: 0 },
    // Negotiation metrics
    totalNegotiations: { type: Number, default: 0 },
    negotiationAcceptanceRate: { type: Number, default: 0 }, // percentage
    // Quality metrics
    conflictCount: { type: Number, default: 0 },
    refundCount: { type: Number, default: 0 },
    // Trending
    reputationTrend: {
      type: String,
      enum: ['improving', 'stable', 'declining'],
      default: 'stable',
    },
    lastUpdated: Date,
  },
  { timestamps: true },
);

// Fraud Detection Log
const fraudDetectionSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    riskFactors: [
      {
        factor: String,
        score: Number,
        reason: String,
      },
    ],
    flag: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'LOW',
    },
    status: {
      type: String,
      enum: ['PENDING_REVIEW', 'APPROVED', 'BLOCKED', 'FALSE_POSITIVE'],
      default: 'PENDING_REVIEW',
    },
    adminReview: {
      reviewedBy: mongoose.Schema.Types.ObjectId,
      reviewedAt: Date,
      decision: String,
      notes: String,
    },
  },
  { timestamps: true },
);

fraudDetectionSchema.index({ flag: 1, status: 1 });
fraudDetectionSchema.index({ userId: 1, createdAt: -1 });

module.exports = {
  MetricsHistory: mongoose.model('MetricsHistory', metricsHistorySchema),
  AuditLog: mongoose.model('AuditLog', auditLogSchema),
  Webhook: mongoose.model('Webhook', webhookSchema),
  SellerAnalytics: mongoose.model('SellerAnalytics', sellerAnalyticsSchema),
  FraudDetection: mongoose.model('FraudDetection', fraudDetectionSchema),
};
