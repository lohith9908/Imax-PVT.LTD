const mongoose = require('mongoose');

// Order Schema - outcome of successful negotiation
const orderSchema = new mongoose.Schema(
  {
    negotiationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Negotiation',
    },
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    orderState: {
      type: String,
      enum: ['CREATED', 'PENDING', 'APPROVED', 'DISPATCHED', 'DELIVERED', 'REJECTED'],
      default: 'CREATED',
    },
    paymentState: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED'],
      default: 'PENDING',
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    pricePerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['COD', 'PREPAID'],
      default: 'COD',
    },
    shippingAddress: {
      city: String,
      state: String,
      zipCode: String,
      fullAddress: String,
    },
    trackingNumber: String,
    notes: String,
    cancelledAt: Date,
    cancelReason: String,
    deliveredAt: Date,
    idempotencyKey: {
      type: String,
      unique: true,
    },
  },
  { timestamps: true },
);

// Indexing for horizontal scaling
orderSchema.index({ farmerId: 1, createdAt: -1 });
orderSchema.index({ ownerId: 1, createdAt: -1 });
orderSchema.index({ orderState: 1 });
orderSchema.index({ paymentState: 1 });
orderSchema.index({ idempotencyKey: 1 });

module.exports = mongoose.model('Order', orderSchema);
