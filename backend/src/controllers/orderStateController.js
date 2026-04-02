const Order = require('../models/Order');
const mongoose = require('mongoose');

// Strict order state machine - no invalid transitions allowed
const VALID_TRANSITIONS = {
  CREATED: ['PENDING'],
  PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['DISPATCHED', 'REJECTED'],
  DISPATCHED: ['DELIVERED', 'REJECTED'],
  DELIVERED: [], // Terminal state
  REJECTED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

/**
 * Validate state transition
 * @param {string} currentState - Current order state
 * @param {string} newState - Desired new state
 * @returns {boolean} - True if transition is valid
 */
const isValidTransition = (currentState, newState) => {
  return VALID_TRANSITIONS[currentState]?.includes(newState) || false;
};

/**
 * Update order state with strict validation and state history
 * Only owner can change order states
 */
const updateOrderState = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;
    const { orderState, reason } = req.body;

    // Validate input
    const validStates = ['CREATED', 'PENDING', 'APPROVED', 'DISPATCHED', 'DELIVERED', 'REJECTED', 'CANCELLED'];
    if (!validStates.includes(orderState)) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Invalid order state' });
    }

    // Fetch order with locking
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify ownership - only owner can update order state
    if (order.ownerId.toString() !== req.user.userId) {
      await session.abortTransaction();
      return res.status(403).json({ error: 'Not authorized - only owner can change order state' });
    }

    // Validate state transition
    if (!isValidTransition(order.orderState, orderState)) {
      await session.abortTransaction();
      return res.status(400).json({
        error: `Invalid state transition: ${order.orderState} → ${orderState}`,
        currentState: order.orderState,
        allowedTransitions: VALID_TRANSITIONS[order.orderState],
      });
    }

    // Handle specific state transitions
    if (orderState === 'DELIVERED') {
      order.deliveredAt = new Date();
    }

    if (orderState === 'REJECTED' || orderState === 'CANCELLED') {
      order.cancelledAt = new Date();
      order.cancelReason = reason || 'No reason provided';
    }

    // Update state and history
    order.orderState = orderState;
    order.stateHistory.push({
      state: orderState,
      transitionedAt: new Date(),
      transitionedBy: req.user.userId,
      reason: reason || 'State transition',
    });

    await order.save({ session });
    await session.commitTransaction();

    res.json({
      message: `Order successfully moved to ${orderState}`,
      order: {
        id: order._id,
        orderState: order.orderState,
        paymentState: order.paymentState,
        stateHistory: order.stateHistory,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Update order state error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    session.endSession();
  }
};

/**
 * Update payment state with validation
 * Only payment states: PENDING → PAID or FAILED
 * Owner confirms payment for COD orders, system confirms for PREPAID
 */
const updatePaymentState = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;
    const { paymentState, reason } = req.body;

    // Validate payment state
    const validPaymentStates = ['PENDING', 'PAID', 'FAILED', 'REFUSED'];
    if (!validPaymentStates.includes(paymentState)) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Invalid payment state' });
    }

    // Fetch order
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify authorization - owner can confirm payment for COD
    if (order.paymentMethod === 'COD' && order.ownerId.toString() !== req.user.userId) {
      await session.abortTransaction();
      return res.status(403).json({ error: 'Only owner can confirm COD payment' });
    }

    // Cannot change payment state if order is already delivered/rejected
    if (['DELIVERED', 'REJECTED', 'CANCELLED'].includes(order.orderState)) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Cannot change payment state for completed order' });
    }

    // Validate payment state transition (no backward transitions)
    const paymentStateOrder = { PENDING: 0, PAID: 1, FAILED: 2, REFUSED: 3 };
    if (paymentState !== 'PENDING' && paymentStateOrder[paymentState] <= paymentStateOrder[order.paymentState]) {
      await session.abortTransaction();
      return res.status(400).json({
        error: `Invalid payment transition: ${order.paymentState} → ${paymentState}`,
      });
    }

    order.paymentState = paymentState;

    if (paymentState === 'PAID' && order.orderState === 'PENDING') {
      // Auto-move to APPROVED when payment confirmed
      order.orderState = 'APPROVED';
      order.stateHistory.push({
        state: 'APPROVED',
        transitionedAt: new Date(),
        transitionedBy: req.user.userId,
        reason: 'Auto-approved after payment confirmed',
      });
    }

    // Handle payment failure - mark conflict
    if (paymentState === 'FAILED' || paymentState === 'REFUSED') {
      order.hasConflict = true;
      order.conflictReason = reason || 'Payment failed or refused';
      order.conflictResolution = 'PAYMENT_FAILED';
    }

    await order.save({ session });
    await session.commitTransaction();

    res.json({
      message: `Payment state updated to ${paymentState}`,
      order: {
        id: order._id,
        orderState: order.orderState,
        paymentState: order.paymentState,
        hasConflict: order.hasConflict,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Update payment state error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    session.endSession();
  }
};

/**
 * Mark order as failed with conflict tracking
 * Used when delivery fails, owner rejects, or other issues occur
 */
const markOrderConflict = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { conflictReason, conflictResolution } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify authorization - both farmer and owner can report conflicts
    const isAuthorized = order.farmerId.toString() === req.user.userId || order.ownerId.toString() === req.user.userId;
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Cannot report conflict on completed order unless it's a delivery failure
    if (['DELIVERED', 'REJECTED', 'CANCELLED'].includes(order.orderState) && conflictResolution !== 'DELIVERY_FAILED') {
      return res.status(400).json({ error: 'Cannot report conflict on completed order' });
    }

    order.hasConflict = true;
    order.conflictReason = conflictReason;
    order.conflictResolution = conflictResolution;
    order.reconciliationStatus = 'PENDING';

    await order.save();

    res.json({
      message: 'Order conflict recorded',
      order: {
        id: order._id,
        hasConflict: order.hasConflict,
        conflictReason: order.conflictReason,
        conflictResolution: order.conflictResolution,
        reconciliationStatus: order.reconciliationStatus,
      },
    });
  } catch (error) {
    console.error('Mark order conflict error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Resolve conflict and apply refund if needed
 * Only ADMIN can resolve conflicts
 */
const resolveConflict = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;
    const { refundAmount } = req.body;

    // Verify admin authorization
    if (req.user.role !== 'ADMIN') {
      await session.abortTransaction();
      return res.status(403).json({ error: 'Only admins can resolve conflicts' });
    }

    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!order.hasConflict) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Order has no active conflict' });
    }

    order.reconciliationStatus = 'RESOLVED';
    order.hasConflict = false;

    // Apply refund if specified
    if (refundAmount && refundAmount > 0) {
      order.refundAmount = refundAmount;
      order.paymentState = 'REFUSED';
      order.reconciliationStatus = 'REFUNDED';
    }

    await order.save({ session });
    await session.commitTransaction();

    res.json({
      message: 'Conflict resolved',
      order: {
        id: order._id,
        hasConflict: order.hasConflict,
        reconciliationStatus: order.reconciliationStatus,
        refundAmount: order.refundAmount,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Resolve conflict error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    session.endSession();
  }
};

/**
 * Get order state transitions history
 * Shows audit trail of all state changes with timestamps and reasons
 */
const getOrderStateHistory = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify authorization
    const isAuthorized = order.farmerId.toString() === req.user.userId || order.ownerId.toString() === req.user.userId;
    if (!isAuthorized && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({
      orderId: order._id,
      currentState: order.orderState,
      currentPaymentState: order.paymentState,
      stateHistory: order.stateHistory,
      conflictInfo: order.hasConflict ? {
        hasConflict: true,
        reason: order.conflictReason,
        resolution: order.conflictResolution,
        reconciliationStatus: order.reconciliationStatus,
      } : null,
    });
  } catch (error) {
    console.error('Get order state history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  updateOrderState,
  updatePaymentState,
  markOrderConflict,
  resolveConflict,
  getOrderStateHistory,
  isValidTransition,
};
