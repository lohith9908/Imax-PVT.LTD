#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');

const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/imax_fertilizer';

async function seed() {
  try {
    await mongoose.connect(mongoURI);
    console.log('✓ Connected to MongoDB');

    // Clear existing collections (optional)
    await mongoose.connection.dropDatabase();
    console.log('✓ Database cleared');

    // Seed initial data here
    console.log('✓ Seed data inserted');

    await mongoose.connection.close();
    console.log('✓ Seed complete');
  } catch (error) {
    console.error('✗ Seed failed:', error.message);
    process.exit(1);
  }
}

seed();
