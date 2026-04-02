const crypto = require('crypto');
const { Webhook } = require('../models/Phase6Models');

/**
 * Webhook Service for external integrations
 * Allows sellers to receive real-time updates for events
 */

/**
 * Trigger webhook for event
 */
const triggerWebhook = async (sellerId, eventType, payload) => {
  try {
    const webhooks = await Webhook.find({
      ownerId: sellerId,
      isActive: true,
      events: eventType,
    });

    for (const webhook of webhooks) {
      sendWebhookRequest(webhook, eventType, payload);
    }
  } catch (error) {
    console.error('Trigger webhook error:', error);
  }
};

/**
 * Send webhook request with retry logic
 */
async function sendWebhookRequest(webhook, eventType, payload, attempt = 1) {
  try {
    // Create HMAC signature for verification
    const signature = crypto
      .createHmac('sha256', webhook.secret || 'default')
      .update(JSON.stringify(payload))
      .digest('hex');

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Event-Type': eventType,
      'X-Delivery-Attempt': attempt.toString(),
      ...Object.fromEntries(webhook.headers || []),
    };

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload,
      }),
      timeout: 10000,
    });

    if (response.ok) {
      // Success
      webhook.successCount += 1;
      webhook.lastTriggeredAt = new Date();
      await webhook.save();
      return true;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`Webhook delivery failed (attempt ${attempt}):`, error.message);

    webhook.failureCount += 1;

    // Retry logic
    if (attempt < webhook.retryPolicy.maxRetries) {
      const delayMs = webhook.retryPolicy.retryDelayMs * Math.pow(2, attempt - 1);
      setTimeout(() => {
        sendWebhookRequest(webhook, eventType, payload, attempt + 1);
      }, delayMs);
    } else {
      // Mark webhook as failed if retries exhausted
      if (webhook.failureCount > 10) {
        webhook.isActive = false;
      }
    }

    await webhook.save();
  }
}

/**
 * Create webhook subscription
 */
const createWebhook = async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only sellers can create webhooks' });
    }

    const { url, events, headers, secret } = req.body;

    if (!url || !events || events.length === 0) {
      return res.status(400).json({ error: 'URL and events are required' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid webhook URL' });
    }

    const webhook = new Webhook({
      ownerId: req.user.userId,
      url,
      events,
      headers: new Map(Object.entries(headers || {})),
      secret: secret || crypto.randomBytes(32).toString('hex'),
    });

    await webhook.save();

    res.status(201).json({
      message: 'Webhook created successfully',
      webhook: {
        id: webhook._id,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.isActive,
        secret: webhook.secret,
      },
    });
  } catch (error) {
    console.error('Create webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get seller's webhooks
 */
const getWebhooks = async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only sellers can view webhooks' });
    }

    const webhooks = await Webhook.find({ ownerId: req.user.userId })
      .select('-secret')
      .sort({ createdAt: -1 });

    res.json({
      webhooks,
    });
  } catch (error) {
    console.error('Get webhooks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update webhook
 */
const updateWebhook = async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only sellers can update webhooks' });
    }

    const { webhookId } = req.params;
    const { url, events, isActive, headers } = req.body;

    const webhook = await Webhook.findById(webhookId);
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    if (webhook.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (url) {
      try {
        new URL(url);
        webhook.url = url;
      } catch {
        return res.status(400).json({ error: 'Invalid webhook URL' });
      }
    }

    if (events) webhook.events = events;
    if (typeof isActive === 'boolean') webhook.isActive = isActive;
    if (headers) webhook.headers = new Map(Object.entries(headers));

    await webhook.save();

    res.json({
      message: 'Webhook updated',
      webhook,
    });
  } catch (error) {
    console.error('Update webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete webhook
 */
const deleteWebhook = async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only sellers can delete webhooks' });
    }

    const { webhookId } = req.params;

    const webhook = await Webhook.findById(webhookId);
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    if (webhook.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await Webhook.findByIdAndDelete(webhookId);

    res.json({
      message: 'Webhook deleted',
    });
  } catch (error) {
    console.error('Delete webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  triggerWebhook,
  createWebhook,
  getWebhooks,
  updateWebhook,
  deleteWebhook,
};
