const rateLimit = require('express-rate-limit');

/**
 * Seller-specific rate limiting
 * Different limits based on seller tier
 */

/**
 * Calculate rate limit based on seller tier
 * Tiers based on trust score
 */
const getSellerRateLimit = (trustScore) => {
  if (trustScore >= 80) {
    // Platinum tier
    return {
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute
      message: 'Too many requests from this seller. Platinum limit: 100/min',
    };
  } else if (trustScore >= 60) {
    // Gold tier
    return {
      windowMs: 60 * 1000,
      max: 50,
      message: 'Too many requests from this seller. Gold limit: 50/min',
    };
  } else if (trustScore >= 40) {
    // Silver tier
    return {
      windowMs: 60 * 1000,
      max: 25,
      message: 'Too many requests from this seller. Silver limit: 25/min',
    };
  }
  // Bronze tier (default)
  return {
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many requests from this seller. Bronze limit: 10/min',
  };
};

/**
 * Seller rate limiter middleware
 * Applied to seller endpoints - limits per seller based on trust score
 */
const sellerRateLimiter = (trustScore = 40) => {
  const limits = getSellerRateLimit(trustScore);

  return rateLimit({
    windowMs: limits.windowMs,
    max: limits.max,
    keyGenerator: (req) => req.user.userId, // Key by seller ID
    skip: (req) => req.user.role === 'ADMIN', // Admins bypass
    message: limits.message,
    standardHeaders: true,
    legacyHeaders: false,
  });
};

/**
 * Order creation rate limiter
 * Strict limit to prevent spam/fraud
 */
const orderCreationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 orders per minute per farmer
  keyGenerator: (req) => req.user.userId,
  skip: (req) => req.user.role === 'ADMIN',
  message: 'Too many orders created. Maximum 5 per minute',
});

/**
 * API endpoint rate limiter
 * General limit for all API endpoints
 */
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 minutes per IP
  keyGenerator: (req) => req.ip,
  skip: (req) => req.user?.role === 'ADMIN',
  message: 'Too many requests from this IP address',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  sellerRateLimiter,
  getSellerRateLimit,
  orderCreationLimiter,
  generalApiLimiter,
};
