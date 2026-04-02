const mongoose = require('mongoose');

// User Schema - for Farmers, Owners, and Admins
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['FARMER', 'OWNER', 'ADMIN'],
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      city: String,
      state: String,
      zipCode: String,
      fullAddress: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: Date,
  },
  { timestamps: true },
);

// Indexing for horizontal scaling
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);
