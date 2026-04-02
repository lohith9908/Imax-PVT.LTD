const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { negotiationRateLimiter } = require('../middleware/rateLimit');
const {
  createNegotiation,
  getNegotiation,
  getFarmerNegotiations,
  getOwnerNegotiations,
  activateNegotiation,
  acceptNegotiation,
  rejectNegotiation,
} = require('../controllers/negotiationController');

// Farmer routes
router.post(
  '/',
  authenticate,
  authorize(['FARMER']),
  negotiationRateLimiter,
  createNegotiation,
);
router.get('/farmer/list', authenticate, authorize(['FARMER']), getFarmerNegotiations);

// Owner routes
router.get('/owner/list', authenticate, authorize(['OWNER']), getOwnerNegotiations);
router.put('/:negotiationId/activate', authenticate, authorize(['OWNER']), activateNegotiation);
router.put('/:negotiationId/accept', authenticate, authorize(['OWNER']), acceptNegotiation);
router.put(
  '/:negotiationId/reject',
  authenticate,
  authorize(['FARMER', 'OWNER']),
  rejectNegotiation,
);

// Public route (read)
router.get('/:id', getNegotiation);

module.exports = router;
