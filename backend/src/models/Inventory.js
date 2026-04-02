const mongoose = require('mongoose');

// Inventory Schema - strict invariant: never below zero
const inventorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      unique: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    availableStock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    reservedStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    soldStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    warehouse: {
      location: String,
      capacity: Number,
    },
    lastRestocked: Date,
  },
  { timestamps: true },
);

// Indexing for horizontal scaling
inventorySchema.index({ productId: 1 });
inventorySchema.index({ ownerId: 1 });
inventorySchema.index({ availableStock: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
