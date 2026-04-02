const Inventory = require('../models/Inventory');
const Order = require('../models/Order');
const mongoose = require('mongoose');

/**
 * Safe stock decrement with optimistic locking
 * Prevents race conditions when multiple orders are created simultaneously
 * Uses MongoDB session transactions for atomicity
 */
const safeDecremmentStock = async (productId, quantity, session) => {
  try {
    // Atomically check and decrement stock in one operation
    const inventory = await Inventory.findOne({ productId }).session(session);

    if (!inventory) {
      throw new Error('Inventory record not found');
    }

    if (inventory.availableStock < quantity) {
      throw new Error(`Insufficient stock. Available: ${inventory.availableStock}, Requested: ${quantity}`);
    }

    // Apply decrement with Math.max to ensure never goes below 0
    const originalStock = inventory.availableStock;
    inventory.availableStock = Math.max(0, inventory.availableStock - quantity);

    // Track stock deduction history
    if (!inventory.stockHistory) {
      inventory.stockHistory = [];
    }

    inventory.stockHistory.push({
      action: 'DECREMENT',
      quantity,
      previousStock: originalStock,
      newStock: inventory.availableStock,
      timestamp: new Date(),
    });

    await inventory.save({ session });

    return {
      success: true,
      newStock: inventory.availableStock,
      decrementedQuantity: Math.min(quantity, originalStock),
    };
  } catch (error) {
    throw new Error(`Stock decrement failed: ${error.message}`);
  }
};

/**
 * Refund stock when order is cancelled or rejected
 * Inverse of safeDecremmentStock with full atomicity
 */
const refundStock = async (productId, quantity, session) => {
  try {
    const inventory = await Inventory.findOne({ productId }).session(session);

    if (!inventory) {
      throw new Error('Inventory record not found');
    }

    const originalStock = inventory.availableStock;
    inventory.availableStock += quantity;

    // Track refund in history
    if (!inventory.stockHistory) {
      inventory.stockHistory = [];
    }

    inventory.stockHistory.push({
      action: 'REFUND',
      quantity,
      previousStock: originalStock,
      newStock: inventory.availableStock,
      timestamp: new Date(),
    });

    await inventory.save({ session });

    return {
      success: true,
      newStock: inventory.availableStock,
      refundedQuantity: quantity,
    };
  } catch (error) {
    throw new Error(`Stock refund failed: ${error.message}`);
  }
};

/**
 * Create order with full concurrency safety and idempotency
 * Validates stock and creates order atomically
 * Returns existing order if idempotency key already used
 */
const createOrderSafe = async (orderData, session) => {
  try {
    const { productId, quantity, idempotencyKey, farmerId, ownerId, pricePerUnit, totalAmount, shippingAddress, paymentMethod } = orderData;

    // Check for idempotent duplicate
    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ idempotencyKey }).session(session);
      if (existingOrder) {
        return {
          isDuplicate: true,
          order: existingOrder,
          message: 'Order already exists with this idempotency key',
        };
      }
    }

    // Decrement stock atomically within transaction
    const stockResult = await safeDecremmentStock(productId, quantity, session);

    if (!stockResult.success) {
      throw new Error('Failed to decrement stock');
    }

    // Create order
    const order = new Order({
      farmerId,
      ownerId,
      productId,
      quantity,
      pricePerUnit,
      totalAmount,
      shippingAddress,
      paymentMethod,
      orderState: 'CREATED',
      paymentState: 'PENDING',
      idempotencyKey,
      stateHistory: [
        {
          state: 'CREATED',
          transitionedAt: new Date(),
          reason: 'Order created',
        },
      ],
    });

    await order.save({ session });

    return {
      isDuplicate: false,
      order,
      stockResult,
    };
  } catch (error) {
    throw new Error(`Create order failed: ${error.message}`);
  }
};

/**
 * Validate idempotency key
 * Returns true if key is unique (safe to use) or matches existing order
 */
const validateIdempotencyKey = async (idempotencyKey) => {
  if (!idempotencyKey) {
    return { isValid: false, reason: 'Idempotency key is required' };
  }

  try {
    const existing = await Order.findOne({ idempotencyKey });
    if (existing) {
      return {
        isValid: true,
        exists: true,
        orderId: existing._id,
        message: 'Order already exists with this key',
      };
    }

    return {
      isValid: true,
      exists: false,
      message: 'Idempotency key is unique and safe to use',
    };
  } catch (error) {
    return { isValid: false, reason: `Validation failed: ${error.message}` };
  }
};

/**
 * Retry order creation with exponential backoff
 * Handles transient failures due to concurrency
 */
const createOrderWithRetry = async (orderData, maxRetries = 3) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const result = await createOrderSafe(orderData, session);
      await session.commitTransaction();
      return { success: true, result, attempts: attempt };
    } catch (error) {
      lastError = error;
      await session.abortTransaction();

      // Exponential backoff: 100ms * 2^(attempt-1)
      const backoffMs = 100 * Math.pow(2, attempt - 1);
      console.warn(`Order creation attempt ${attempt} failed. Retrying in ${backoffMs}ms...`, error.message);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    } finally {
      session.endSession();
    }
  }

  return { success: false, error: lastError?.message, attempts: maxRetries };
};

/**
 * Handle single shop per order constraint
 * Ensures order only contains products from one owner
 * Used in bulk order scenarios (future enhancement)
 */
const validateSingleShopConstraint = async (productIds) => {
  try {
    const products = await mongoose.model('Product').find({ _id: { $in: productIds } }).select('ownerId');

    if (products.length === 0) {
      return { valid: false, reason: 'Products not found' };
    }

    const ownerIds = new Set(products.map(p => p.ownerId.toString()));

    if (ownerIds.size > 1) {
      return {
        valid: false,
        reason: 'Orders can only contain products from a single shop',
        uniqueOwners: ownerIds.size,
      };
    }

    return { valid: true, ownerId: Array.from(ownerIds)[0] };
  } catch (error) {
    return { valid: false, reason: `Validation failed: ${error.message}` };
  }
};

module.exports = {
  safeDecremmentStock,
  refundStock,
  createOrderSafe,
  validateIdempotencyKey,
  createOrderWithRetry,
  validateSingleShopConstraint,
};
