const Product = require('../models/Product');
const Inventory = require('../models/Inventory');

// Create product (Owner/Admin only)
const createProduct = async (req, res) => {
  try {
    const { name, description, category, basePrice, unit, minOrderQuantity } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // Validate input
    if (!name || !description || !category || basePrice === undefined || !unit) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (basePrice < 0) {
      return res.status(400).json({ error: 'Price cannot be negative' });
    }

    if (!['kg', 'liter', 'bag', 'ton'].includes(unit)) {
      return res.status(400).json({ error: 'Invalid unit' });
    }

    // Create product
    const product = new Product({
      name,
      description,
      category,
      basePrice,
      unit,
      minOrderQuantity: minOrderQuantity || 1,
      imageUrl,
      ownerId: req.user.userId,
    });

    await product.save();

    // Create corresponding inventory record
    const inventory = new Inventory({
      productId: product._id,
      ownerId: req.user.userId,
      availableStock: 0,
    });

    await inventory.save();

    res.status(201).json({
      message: 'Product created successfully',
      product: {
        id: product._id,
        name: product.name,
        category: product.category,
        basePrice: product.basePrice,
        imageUrl: product.imageUrl,
      },
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get product by ID
const getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id).populate('ownerId', 'firstName lastName email phone');
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const inventory = await Inventory.findOne({ productId: id });

    res.json({
      product,
      inventory: inventory ? { availableStock: inventory.availableStock } : null,
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all products (with pagination)
const getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;

    let filter = { isActive: true };

    if (category) {
      filter.category = category;
    }

    if (search) {
      filter.$text = { $search: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Product.find(filter)
      .populate('ownerId', 'firstName lastName email phone')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments(filter);

    // Get inventory for all products
    const inventories = await Inventory.find({
      productId: { $in: products.map((p) => p._id) },
    });

    const inventoryMap = {};
    inventories.forEach((inv) => {
      inventoryMap[inv.productId] = inv.availableStock;
    });

    const productsWithInventory = products.map((p) => ({
      ...p.toObject(),
      availableStock: inventoryMap[p._id] || 0,
    }));

    res.json({
      products: productsWithInventory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update product (Owner only)
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, basePrice, unit, minOrderQuantity, isActive } =
      req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Verify ownership
    if (product.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to update this product' });
    }

    // Update fields
    if (name) product.name = name;
    if (description) product.description = description;
    if (category) product.category = category;
    if (basePrice !== undefined) product.basePrice = basePrice;
    if (unit) product.unit = unit;
    if (minOrderQuantity) product.minOrderQuantity = minOrderQuantity;
    if (isActive !== undefined) product.isActive = isActive;

    // Handle new image upload
    if (req.file) {
      product.imageUrl = `/uploads/${req.file.filename}`;
    }

    await product.save();

    res.json({
      message: 'Product updated successfully',
      product: {
        id: product._id,
        name: product.name,
        category: product.category,
        basePrice: product.basePrice,
        imageUrl: product.imageUrl,
      },
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete product (Owner only)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Verify ownership
    if (product.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this product' });
    }

    // Soft delete
    product.isActive = false;
    await product.save();

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get owner's products
const getOwnerProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Product.find({ ownerId: req.user.userId })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments({ ownerId: req.user.userId });

    // Get inventory for all owner's products
    const inventories = await Inventory.find({
      productId: { $in: products.map((p) => p._id) },
    });

    const inventoryMap = {};
    inventories.forEach((inv) => {
      inventoryMap[inv.productId] = inv.availableStock;
    });

    const productsWithInventory = products.map((p) => ({
      ...p.toObject(),
      availableStock: inventoryMap[p._id] || 0,
    }));

    res.json({
      products: productsWithInventory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get owner products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createProduct,
  getProduct,
  getAllProducts,
  updateProduct,
  deleteProduct,
  getOwnerProducts,
};
