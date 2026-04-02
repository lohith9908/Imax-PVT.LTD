const mongoose = require('mongoose');

// Negotiation Schema - core stateful domain
const negotiationSchema = new mongoose.Schema(
  {
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
    state: {
      type: String,
      enum: ['INITIATED', 'ACTIVE', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
      default: 'INITIATED',
    },
    initialQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    initialPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    currentOffer: {
      farmerId: String,
      quantity: Number,
      pricePerUnit: Number,
      timestamp: Date,
    },
    messages: [
      {
        senderId: mongoose.Schema.Types.ObjectId,
        senderRole: String,
        content: String,
        timestamp: Date,
      },
    ],
    expiresAt: Date,
    acceptedAt: Date,
    rejectedAt: Date,
    rejectionReason: String,
  },
  { timestamps: true },
);

// Indexing for horizontal scaling
negotiationSchema.index({ farmerId: 1, state: 1 });
negotiationSchema.index({ ownerId: 1, state: 1 });
negotiationSchema.index({ state: 1 });
negotiationSchema.index({ createdAt: -1 });
negotiationSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Negotiation', negotiationSchema);
