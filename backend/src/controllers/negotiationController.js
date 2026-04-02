const Negotiation = require('../models/Negotiation');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const Order = require('../models/Order');
const { decrementStock } = require('./inventoryController');
const crypto = require('crypto');

// State machine transitions - STRICT
const VALID_TRANSITIONS = {
  INITIATED: ['ACTIVE'],
  ACTIVE: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
};

// Validate state transition
const isValidTransition = (currentState, newState) => {
  return VALID_TRANSITIONS[currentState]?.includes(newState) || false;
};

// Create negotiation (Farmer initiates)
const createNegotiation = async (req, res) => {
  try {
    const { productId, quantity, initialPrice } = req.body;

    // Validate input
    if (!productId || !quantity || initialPrice === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (quantity <= 0 || initialPrice < 0) {
      return res.status(400).json({ error: 'Quantity and price must be positive' });
    }

    // Get product and verify it exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get inventory to check stock availability
    const inventory = await Inventory.findOne({ productId });
    if (!inventory || inventory.availableStock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock for negotiation' });
    }

    // Create negotiation
    const negotiation = new Negotiation({
      farmerId: req.user.userId,
      ownerId: product.ownerId,
      productId,
      state: 'INITIATED',
      initialQuantity: quantity,
      initialPrice,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    await negotiation.save();

    res.status(201).json({
      message: 'Negotiation initiated',
      negotiation: {
        id: negotiation._id,
        productId: negotiation.productId,
        state: negotiation.state,
        initialQuantity: negotiation.initialQuantity,
        initialPrice: negotiation.initialPrice,
        expiresAt: negotiation.expiresAt,
      },
    });
  } catch (error) {
    console.error('Create negotiation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get negotiation by ID
const getNegotiation = async (req, res) => {
  try {
    const { id } = req.params;

    const negotiation = await Negotiation.findById(id)
      .populate('farmerId', 'firstName lastName email')
      .populate('ownerId', 'firstName lastName email')
      .populate('productId', 'name basePrice');

    if (!negotiation) {
      return res.status(404).json({ error: 'Negotiation not found' });
    }

    res.json({ negotiation });
  } catch (error) {
    console.error('Get negotiation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get farmer's negotiations
const getFarmerNegotiations = async (req, res) => {
  try {
    const { page = 1, limit = 20, state } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = { farmerId: req.user.userId };
    if (state) {
      filter.state = state;
    }

    const negotiations = await Negotiation.find(filter)
      .populate('ownerId', 'firstName lastName email phone')
      .populate('productId', 'name basePrice')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Negotiation.countDocuments(filter);

    res.json({
      negotiations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get farmer negotiations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get owner's negotiations
const getOwnerNegotiations = async (req, res) => {
  try {
    const { page = 1, limit = 20, state } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = { ownerId: req.user.userId };
    if (state) {
      filter.state = state;
    }

    const negotiations = await Negotiation.find(filter)
      .populate('farmerId', 'firstName lastName email phone')
      .populate('productId', 'name basePrice')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Negotiation.countDocuments(filter);

    res.json({
      negotiations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get owner negotiations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Activate negotiation (Owner moves to ACTIVE state)
const activateNegotiation = async (req, res) => {
  try {
    const { negotiationId } = req.params;

    const negotiation = await Negotiation.findById(negotiationId);
    if (!negotiation) {
      return res.status(404).json({ error: 'Negotiation not found' });
    }

    // Verify ownership
    if (negotiation.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Validate state transition
    if (!isValidTransition(negotiation.state, 'ACTIVE')) {
      return res.status(400).json({
        error: `Cannot transition from ${negotiation.state} to ACTIVE`,
      });
    }

    negotiation.state = 'ACTIVE';
    await negotiation.save();

    res.json({
      message: 'Negotiation activated - ready for messaging',
      negotiation: {
        id: negotiation._id,
        state: negotiation.state,
      },
    });
  } catch (error) {
    console.error('Activate negotiation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Accept negotiation and create order (Owner)
const acceptNegotiation = async (req, res) => {
  try {
    const { negotiationId } = req.params;
    const { quantity, finalPrice } = req.body;

    const negotiation = await Negotiation.findById(negotiationId).populate('productId');
    if (!negotiation) {
      return res.status(404).json({ error: 'Negotiation not found' });
    }

    // Verify ownership
    if (negotiation.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Validate state transition
    if (!isValidTransition(negotiation.state, 'ACCEPTED')) {
      return res.status(400).json({
        error: `Cannot accept negotiation in ${negotiation.state} state`,
      });
    }

    // Validate inventory
    const inventory = await Inventory.findOne({ productId: negotiation.productId._id });
    if (!inventory || inventory.availableStock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock to accept negotiation' });
    }

    // Update negotiation state
    negotiation.state = 'ACCEPTED';
    negotiation.acceptedAt = new Date();
    negotiation.currentOffer = {
      farmerId: negotiation.farmerId.toString(),
      quantity,
      pricePerUnit: finalPrice,
    };
    await negotiation.save();

    // Create order from accepted negotiation
    const totalAmount = quantity * finalPrice;
    const idempotencyKey = crypto.randomBytes(16).toString('hex');

    const order = new Order({
      negotiationId: negotiation._id,
      farmerId: negotiation.farmerId,
      ownerId: negotiation.ownerId,
      productId: negotiation.productId._id,
      orderState: 'PENDING',
      paymentState: 'PENDING',
      paymentMethod: 'COD',
      quantity,
      pricePerUnit: finalPrice,
      totalAmount,
      idempotencyKey,
    });

    // Decrement stock
    try {
      await decrementStock(negotiation.productId._id, quantity);
      await order.save();

      res.json({
        message: 'Negotiation accepted and order created',
        order: {
          id: order._id,
          quantity,
          pricePerUnit: finalPrice,
          totalAmount,
        },
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  } catch (error) {
    console.error('Accept negotiation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reject negotiation
const rejectNegotiation = async (req, res) => {
  try {
    const { negotiationId } = req.params;
    const { reason } = req.body;

    const negotiation = await Negotiation.findById(negotiationId);
    if (!negotiation) {
      return res.status(404).json({ error: 'Negotiation not found' });
    }

    // Both farmer and owner can reject
    const isFarmer = negotiation.farmerId.toString() === req.user.userId;
    const isOwner = negotiation.ownerId.toString() === req.user.userId;
    if (!isFarmer && !isOwner) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Cannot reject if already accepted
    if (negotiation.state === 'ACCEPTED' || negotiation.state === 'EXPIRED') {
      return res.status(400).json({
        error: `Cannot reject negotiation in ${negotiation.state} state`,
      });
    }

    // Validate state transition
    if (!isValidTransition(negotiation.state, 'REJECTED')) {
      return res.status(400).json({
        error: `Cannot transition from ${negotiation.state} to REJECTED`,
      });
    }

    negotiation.state = 'REJECTED';
    negotiation.rejectedAt = new Date();
    negotiation.rejectionReason = reason || 'No reason provided';
    await negotiation.save();

    res.json({
      message: 'Negotiation rejected',
      negotiation: {
        id: negotiation._id,
        state: negotiation.state,
        rejectionReason: negotiation.rejectionReason,
      },
    });
  } catch (error) {
    console.error('Reject negotiation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createNegotiation,
  getNegotiation,
  getFarmerNegotiations,
  getOwnerNegotiations,
  activateNegotiation,
  acceptNegotiation,
  rejectNegotiation,
  isValidTransition,
};
