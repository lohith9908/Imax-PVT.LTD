const Inventory = require('../models/Inventory');

// Update stock (Owner only)
const updateStock = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || quantity === undefined) {
      return res.status(400).json({ error: 'Product ID and quantity required' });
    }

    const inventory = await Inventory.findOne({ productId });
    if (!inventory) {
      return res.status(404).json({ error: 'Inventory not found' });
    }

    // Verify ownership
    if (inventory.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Ensure stock never goes below zero
    if (quantity < 0) {
      return res.status(400).json({ error: 'Quantity cannot be negative' });
    }

    inventory.availableStock = quantity;
    inventory.lastRestocked = new Date();
    await inventory.save();

    res.json({
      message: 'Stock updated successfully',
      inventory: {
        productId: inventory.productId,
        availableStock: inventory.availableStock,
        lastRestocked: inventory.lastRestocked,
      },
    });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get inventory by product
const getInventory = async (req, res) => {
  try {
    const { productId } = req.params;

    const inventory = await Inventory.findOne({ productId });
    if (!inventory) {
      return res.status(404).json({ error: 'Inventory not found' });
    }

    res.json({ inventory });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get owner's inventory
const getOwnerInventory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const inventories = await Inventory.find({ ownerId: req.user.userId })
      .populate('productId', 'name category basePrice')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Inventory.countDocuments({ ownerId: req.user.userId });

    res.json({
      inventories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get owner inventory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Request to reduce inventory (internal use)
const decrementStock = async (productId, quantity) => {
  const inventory = await Inventory.findOne({ productId });

  if (!inventory) {
    throw new Error('Inventory not found');
  }

  // Check if stock available
  if (inventory.availableStock < quantity) {
    throw new Error('Insufficient stock');
  }

  // Decrement stock - invariant: never below zero
  inventory.availableStock = Math.max(0, inventory.availableStock - quantity);
  inventory.soldStock += quantity;
  await inventory.save();

  return inventory;
};

// Request to increment inventory (restocking)
const incrementStock = async (productId, quantity) => {
  const inventory = await Inventory.findOne({ productId });

  if (!inventory) {
    throw new Error('Inventory not found');
  }

  inventory.availableStock += quantity;
  await inventory.save();

  return inventory;
};

module.exports = {
  updateStock,
  getInventory,
  getOwnerInventory,
  decrementStock,
  incrementStock,
};
