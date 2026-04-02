const Negotiation = require('../models/Negotiation');

// Background worker to scan and expire negotiations
const expireNegotiations = async () => {
  try {
    const now = new Date();

    // Find all ACTIVE negotiations that have expired
    const expiredNegotiations = await Negotiation.find({
      state: 'ACTIVE',
      expiresAt: { $lt: now },
    });

    if (expiredNegotiations.length === 0) {
      console.log('✓ Expiry check complete - no negotiations to expire');
      return;
    }

    // Update their state to EXPIRED
    const result = await Negotiation.updateMany(
      {
        state: 'ACTIVE',
        expiresAt: { $lt: now },
      },
      {
        $set: { state: 'EXPIRED' },
      },
    );

    console.log(`✓ Expired ${result.modifiedCount} negotiations`);
  } catch (error) {
    console.error('✗ Negotiation expiry worker error:', error);
  }
};

// Start background worker - runs every 5 minutes
const startExpiryWorker = () => {
  console.log('✓ Starting negotiation expiry worker (runs every 5 minutes)');
  setInterval(expireNegotiations, 5 * 60 * 1000);
  // Run immediately on start
  expireNegotiations();
};

module.exports = {
  expireNegotiations,
  startExpiryWorker,
};
