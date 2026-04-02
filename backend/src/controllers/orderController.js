const Order = require('../models/Order');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const { decrementStock } = require('./inventoryController');
const crypto = require('crypto');

// Create direct purchase order (no negotiation)
const createDirectOrder = async (req, res) => {
  try {
    const { productId, quantity, shippingAddress } = req.body;

    // Validate input
    if (!productId || !quantity || !shippingAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be positive' });
    }

    // Get product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get inventory - enforce invariant: stock > 0
    const inventory = await Inventory.findOne({ productId });
    if (!inventory || inventory.availableStock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock available' });
    }

    // Check minimum order quantity
    if (quantity < product.minOrderQuantity) {
      return res.status(400).json({
        error: `Minimum order quantity is ${product.minOrderQuantity}`,
      });
    }

    // Calculate total amount (apply bulk pricing if applicable)
    const totalAmount = quantity * product.basePrice;

    // Generate idempotency key to prevent duplicate orders
    const idempotencyKey = crypto.randomBytes(16).toString('hex');

    // Create order
    const order = new Order({
      farmerId: req.user.userId,
      ownerId: product.ownerId,
      productId: productId,
      orderState: 'CREATED',
      paymentState: 'PENDING',
      paymentMethod: 'COD',
      quantity,
      pricePerUnit: product.basePrice,
      totalAmount,
      shippingAddress,
      idempotencyKey,
    });

    // Transactional: try to decrement stock
    try {
      await decrementStock(productId, quantity);
      order.orderState = 'PENDING';
      await order.save();

      res.status(201).json({
        message: 'Order created successfully',
        order: {
          id: order._id,
          productId: order.productId,
          quantity: order.quantity,
          totalAmount: order.totalAmount,
          orderState: order.orderState,
          paymentState: order.paymentState,
          trackingNumber: order.trackingNumber,
        },
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get farmer's orders
const getFarmerOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = { farmerId: req.user.userId };
    if (status) {
      filter.orderState = status;
    }

    const orders = await Order.find(filter)
      .populate('productId', 'name basePrice')
      .populate('ownerId', 'firstName lastName email phone')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get farmer orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get owner's orders
const getOwnerOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = { ownerId: req.user.userId };
    if (status) {
      filter.orderState = status;
    }

    const orders = await Order.find(filter)
      .populate('productId', 'name basePrice')
      .populate('farmerId', 'firstName lastName email phone')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get owner orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update order state (Owner only)
const updateOrderState = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderState } = req.body;

    const validStates = ['CREATED', 'PENDING', 'APPROVED', 'DISPATCHED', 'DELIVERED', 'REJECTED'];
    if (!validStates.includes(orderState)) {
      return res.status(400).json({ error: 'Invalid order state' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify ownership (only owner can update order state)
    if (order.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Prevent invalid transitions - basic validation
    const stateOrder = ['CREATED', 'PENDING', 'APPROVED', 'DISPATCHED', 'DELIVERED'];
    const currentIndex = stateOrder.indexOf(order.orderState);
    const newIndex = stateOrder.indexOf(orderState);

    if (orderState === 'REJECTED') {
      // Can reject from most states
      order.orderState = 'REJECTED';
    } else if (newIndex > currentIndex || newIndex === -1) {
      return res.status(400).json({ error: 'Invalid state transition' });
    } else {
      order.orderState = orderState;
    }

    if (orderState === 'DELIVERED') {
      order.deliveredAt = new Date();
    }

    await order.save();

    res.json({
      message: `Order moved to ${orderState}`,
      order: {
        id: order._id,
        orderState: order.orderState,
        paymentState: order.paymentState,
      },
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Confirm payment for COD order
const confirmPayment = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify ownership
    if (order.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (order.paymentState !== 'PENDING') {
      return res.status(400).json({ error: 'Order payment already processed' });
    }

    order.paymentState = 'PAID';
    await order.save();

    res.json({
      message: 'Payment confirmed',
      order: {
        id: order._id,
        paymentState: order.paymentState,
      },
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createDirectOrder,
  getFarmerOrders,
  getOwnerOrders,
  updateOrderState,
  confirmPayment,
};
