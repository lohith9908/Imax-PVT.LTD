#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Inventory = require('../src/models/Inventory');
const Negotiation = require('../src/models/Negotiation');
const Order = require('../src/models/Order');

const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/imax_fertilizer';

async function seed() {
  try {
    await mongoose.connect(mongoURI);
    console.log('✓ Connected to MongoDB');

    // Clear existing collections
    await mongoose.connection.dropDatabase();
    console.log('✓ Database cleared');

    // Create sample users
    const hashedPassword = await bcrypt.hash('password123', 10);

    const farmer = await User.create({
      email: 'farmer@example.com',
      password: hashedPassword,
      firstName: 'Rajesh',
      lastName: 'Kumar',
      role: 'FARMER',
      phone: '9999999999',
      address: {
        city: 'Bangalore',
        state: 'Karnataka',
        zipCode: '560001',
      },
      isActive: true,
      isVerified: true,
    });

    const owner = await User.create({
      email: 'owner@example.com',
      password: hashedPassword,
      firstName: 'Priya',
      lastName: 'Singh',
      role: 'OWNER',
      phone: '8888888888',
      address: {
        city: 'Delhi',
        state: 'Delhi',
        zipCode: '110001',
      },
      isActive: true,
      isVerified: true,
    });

    const admin = await User.create({
      email: 'admin@example.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      phone: '7777777777',
      isActive: true,
      isVerified: true,
    });

    console.log('✓ Users created:', { farmer: farmer._id, owner: owner._id, admin: admin._id });

    // Create sample products
    const products = await Product.insertMany([
      {
        name: 'Urea Fertilizer',
        description: 'High quality nitrogen fertilizer suitable for all crops',
        ownerId: owner._id,
        category: 'Nitrogen',
        basePrice: 500,
        unit: 'kg',
        minOrderQuantity: 50,
        isActive: true,
      },
      {
        name: 'DAP (Diammonium Phosphate)',
        description: 'Essential phosphorus and nitrogen compound',
        ownerId: owner._id,
        category: 'Phosphorus',
        basePrice: 800,
        unit: 'kg',
        minOrderQuantity: 50,
        isActive: true,
      },
      {
        name: 'Potassium Sulphate',
        description: 'Premium potassium source for crop nutrition',
        ownerId: owner._id,
        category: 'Potassium',
        basePrice: 600,
        unit: 'kg',
        minOrderQuantity: 50,
        isActive: true,
      },
    ]);

    console.log('✓ Products created:', products.length);

    // Create inventory for each product
    for (const product of products) {
      await Inventory.create({
        productId: product._id,
        ownerId: owner._id,
        availableStock: 10000,
        reservedStock: 0,
        soldStock: 0,
        warehouse: {
          location: 'Delhi Warehouse',
          capacity: 50000,
        },
        lastRestocked: new Date(),
      });
    }

    console.log('✓ Inventory created for', products.length, 'products');

    // Create sample negotiations
    const negotiation = await Negotiation.create({
      farmerId: farmer._id,
      ownerId: owner._id,
      productId: products[0]._id,
      state: 'INITIATED',
      initialQuantity: 500,
      initialPrice: 450,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    console.log('✓ Sample negotiation created:', negotiation._id);

    // Create sample orders for Phase 4 testing
    const orders = await Order.insertMany([
      {
        farmerId: farmer._id,
        ownerId: owner._id,
        productId: products[0]._id,
        orderState: 'CREATED',
        paymentState: 'PENDING',
        quantity: 100,
        pricePerUnit: 500,
        totalAmount: 50000,
        paymentMethod: 'COD',
        shippingAddress: {
          city: 'Bangalore',
          state: 'Karnataka',
          zipCode: '560001',
          fullAddress: '123 Farm Lane, Bangalore',
        },
        idempotencyKey: crypto.randomBytes(16).toString('hex'),
        stateHistory: [{
          state: 'CREATED',
          transitionedAt: new Date(),
          reason: 'Order created',
        }],
      },
      {
        farmerId: farmer._id,
        ownerId: owner._id,
        productId: products[1]._id,
        orderState: 'PENDING',
        paymentState: 'PENDING',
        quantity: 150,
        pricePerUnit: 800,
        totalAmount: 120000,
        paymentMethod: 'COD',
        shippingAddress: {
          city: 'Bangalore',
          state: 'Karnataka',
          zipCode: '560001',
          fullAddress: '123 Farm Lane, Bangalore',
        },
        idempotencyKey: crypto.randomBytes(16).toString('hex'),
        stateHistory: [{
          state: 'CREATED',
          transitionedAt: new Date(),
          reason: 'Order created',
        }, {
          state: 'PENDING',
          transitionedAt: new Date(),
          reason: 'After stock decrement',
        }],
      },
      {
        farmerId: farmer._id,
        ownerId: owner._id,
        productId: products[2]._id,
        orderState: 'APPROVED',
        paymentState: 'PAID',
        quantity: 80,
        pricePerUnit: 600,
        totalAmount: 48000,
        paymentMethod: 'COD',
        shippingAddress: {
          city: 'Bangalore',
          state: 'Karnataka',
          zipCode: '560001',
          fullAddress: '123 Farm Lane, Bangalore',
        },
        idempotencyKey: crypto.randomBytes(16).toString('hex'),
        stateHistory: [{
          state: 'CREATED',
          transitionedAt: new Date(),
          reason: 'Order created',
        }, {
          state: 'PENDING',
          transitionedAt: new Date(),
          reason: 'After stock decrement',
        }, {
          state: 'APPROVED',
          transitionedAt: new Date(),
          reason: 'Auto-approved after payment confirmed',
        }],
      },
      {
        farmerId: farmer._id,
        ownerId: owner._id,
        productId: products[0]._id,
        orderState: 'DISPATCHED',
        paymentState: 'PAID',
        quantity: 120,
        pricePerUnit: 500,
        totalAmount: 60000,
        paymentMethod: 'COD',
        trackingNumber: 'TRACK123456789',
        shippingAddress: {
          city: 'Bangalore',
          state: 'Karnataka',
          zipCode: '560001',
          fullAddress: '123 Farm Lane, Bangalore',
        },
        idempotencyKey: crypto.randomBytes(16).toString('hex'),
        stateHistory: [{
          state: 'CREATED',
          transitionedAt: new Date(),
          reason: 'Order created',
        }, {
          state: 'PENDING',
          transitionedAt: new Date(),
          reason: 'After stock decrement',
        }, {
          state: 'APPROVED',
          transitionedAt: new Date(),
          reason: 'Auto-approved after payment confirmed',
        }, {
          state: 'DISPATCHED',
          transitionedAt: new Date(),
          reason: 'Order dispatched to shipping',
        }],
      },
      {
        farmerId: farmer._id,
        ownerId: owner._id,
        productId: products[1]._id,
        orderState: 'DELIVERED',
        paymentState: 'PAID',
        quantity: 100,
        pricePerUnit: 800,
        totalAmount: 80000,
        paymentMethod: 'COD',
        trackingNumber: 'TRACK987654321',
        deliveredAt: new Date(),
        shippingAddress: {
          city: 'Bangalore',
          state: 'Karnataka',
          zipCode: '560001',
          fullAddress: '123 Farm Lane, Bangalore',
        },
        idempotencyKey: crypto.randomBytes(16).toString('hex'),
        stateHistory: [{
          state: 'CREATED',
          transitionedAt: new Date(),
          reason: 'Order created',
        }, {
          state: 'PENDING',
          transitionedAt: new Date(),
          reason: 'After stock decrement',
        }, {
          state: 'APPROVED',
          transitionedAt: new Date(),
          reason: 'Auto-approved after payment confirmed',
        }, {
          state: 'DISPATCHED',
          transitionedAt: new Date(),
          reason: 'Order dispatched to shipping',
        }, {
          state: 'DELIVERED',
          transitionedAt: new Date(),
          reason: 'Order delivered to farmer',
        }],
      },
    ]);

    console.log('✓ Sample orders created:', orders.length);

    await mongoose.connection.close();
    console.log('✓ Seed complete - Database ready!');
    console.log('\n📋 Sample Credentials:');
    console.log('   Farmer: farmer@example.com / password123');
    console.log('   Owner:  owner@example.com / password123');
    console.log('   Admin:  admin@example.com / password123');
    console.log('\n📦 Phase 4 Sample Orders:');
    console.log('   1. CREATED + PENDING (initial state)');
    console.log('   2. PENDING + PENDING (ready for approval)');
    console.log('   3. APPROVED + PAID (approved and paid)');
    console.log('   4. DISPATCHED + PAID (shipped)');
    console.log('   5. DELIVERED + PAID (completed)');
  } catch (error) {
    console.error('✗ Seed failed:', error.message);
    process.exit(1);
  }
}

seed();
