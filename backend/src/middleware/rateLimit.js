const rateLimit = require('express-rate-limit');

// Rate limiter for negotiation creation - prevent spam
const negotiationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 negotiations per hour per user
  message: 'Too many negotiations created. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === 'ADMIN', // Admins bypass rate limit
  keyGenerator: (req) => req.user?.userId || req.ip,
});

module.exports = {
  negotiationRateLimiter,
};
