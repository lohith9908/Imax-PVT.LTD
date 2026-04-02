const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  createDirectOrder,
  getFarmerOrders,
  getOwnerOrders,
} = require('../controllers/orderController');
const {
  updateOrderState,
  updatePaymentState,
  markOrderConflict,
  resolveConflict,
  getOrderStateHistory,
} = require('../controllers/orderStateController');

// ============ Phase 2: Direct Orders ============

// Farmer creates direct purchase order
router.post('/direct', authenticate, authorize(['FARMER']), createDirectOrder);

// Get farmer's orders
router.get('/farmer/list', authenticate, authorize(['FARMER']), getFarmerOrders);

// Get owner's orders
router.get('/owner/list', authenticate, authorize(['OWNER']), getOwnerOrders);

// ============ Phase 4: Order Lifecycle & Fulfillment ============

// Update order state (strict state machine)
// CREATED → PENDING → APPROVED → DISPATCHED → DELIVERED
// Any state can transition to REJECTED or CANCELLED
router.put('/:orderId/state', authenticate, authorize(['OWNER']), updateOrderState);

// Update payment state
// PENDING → PAID or FAILED
// Owner confirms COD payment
router.put('/:orderId/payment', authenticate, authorize(['OWNER']), updatePaymentState);

// Mark order as having a conflict (stock issue, delivery failure, etc)
// Both farmer and owner can report conflicts
router.put('/:orderId/conflict', authenticate, authorize(['FARMER', 'OWNER']), markOrderConflict);

// Resolve conflict and apply refund if needed
// Only admins can resolve conflicts
router.put('/:orderId/resolve-conflict', authenticate, authorize(['ADMIN']), resolveConflict);

// Get complete state transition history and audit trail
// Farmer, Owner, or Admin can view
router.get('/:orderId/state-history', authenticate, authorize(['FARMER', 'OWNER', 'ADMIN']), getOrderStateHistory);

module.exports = router;
