const mongoose = require('mongoose');

// Product Schema - owned by Owners/Sellers
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    basePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      required: true,
      enum: ['kg', 'liter', 'bag', 'ton'],
    },
    minOrderQuantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    imageUrl: String,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Indexing for horizontal scaling
productSchema.index({ ownerId: 1 });
productSchema.index({ category: 1 });
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);
