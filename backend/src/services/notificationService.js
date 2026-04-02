/**
 * Notification Service
 * In-memory queue for order, negotiation, and system notifications
 * Stores recent notifications for admin dashboard
 * Extensible for SMS/Email integration (Phase 6)
 */

class NotificationQueue {
  constructor(maxSize = 1000) {
    this.queue = [];
    this.maxSize = maxSize;
    this.listeners = new Map(); // WebSocket listeners
  }

  /**
   * Add notification to queue
   */
  enqueue(notification) {
    const notif = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      isRead: false,
      ...notification,
    };

    this.queue.unshift(notif); // Add to top

    // Keep queue size bounded
    if (this.queue.length > this.maxSize) {
      this.queue.pop();
    }

    // Notify listeners
    this.broadcast(notif);

    return notif;
  }

  /**
   * Get notifications with filters
   */
  getNotifications(type = null, isRead = null, limit = 50) {
    let filtered = this.queue;

    if (type) {
      filtered = filtered.filter(n => n.type === type);
    }

    if (isRead !== null) {
      filtered = filtered.filter(n => n.isRead === isRead);
    }

    return filtered.slice(0, limit);
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId) {
    const notif = this.queue.find(n => n.id === notificationId);
    if (notif) {
      notif.isRead = true;
    }
    return notif;
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead() {
    this.queue.forEach(n => {
      n.isRead = true;
    });
  }

  /**
   * Get unread count
   */
  getUnreadCount() {
    return this.queue.filter(n => !n.isRead).length;
  }

  /**
   * Subscribe to notifications (WebSocket-style)
   */
  subscribe(userId, callback) {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, []);
    }
    this.listeners.get(userId).push(callback);
  }

  /**
   * Unsubscribe from notifications
   */
  unsubscribe(userId, callback) {
    if (this.listeners.has(userId)) {
      const callbacks = this.listeners.get(userId);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Broadcast notification to listeners
   */
  broadcast(notification) {
    // To specific user if targetUserId exists
    if (notification.targetUserId && this.listeners.has(notification.targetUserId)) {
      this.listeners.get(notification.targetUserId).forEach(callback => {
        callback(notification);
      });
    }

    // To all admins if isAdminAlert
    if (notification.isAdminAlert) {
      this.listeners.forEach((callbacks) => {
        callbacks.forEach(callback => {
          callback(notification);
        });
      });
    }
  }

  /**
   * Clear old notifications (older than ttlMs)
   */
  prune(ttlMs = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - ttlMs;
    this.queue = this.queue.filter(n => n.timestamp.getTime() > cutoff);
  }

  /**
   * Get queue stats
   */
  getStats() {
    return {
      totalNotifications: this.queue.length,
      unreadCount: this.getUnreadCount(),
      oldestNotification: this.queue[this.queue.length - 1]?.timestamp || null,
      newestNotification: this.queue[0]?.timestamp || null,
    };
  }
}

// Global singleton instance
const notificationQueue = new NotificationQueue();

/**
 * Notification factory functions
 */
const createNotification = {
  /**
   * Order created notification
   */
  orderCreated: (farmerId, ownerId, orderId, quantity, totalAmount) => ({
    type: 'ORDER_CREATED',
    severity: 'info',
    title: 'New Order Received',
    message: `New order ${orderId} for ${quantity} units (${totalAmount} total)`,
    targetUserId: ownerId,
    isAdminAlert: true,
    data: { orderId, farmerId, ownerId, quantity, totalAmount },
  }),

  /**
   * Payment received notification
   */
  paymentReceived: (farmerId, ownerId, orderId, amount) => ({
    type: 'PAYMENT_RECEIVED',
    severity: 'success',
    title: 'Payment Confirmed',
    message: `Payment of ${amount} received for order ${orderId}`,
    targetUserId: ownerId,
    isAdminAlert: true,
    data: { orderId, farmerId, ownerId, amount },
  }),

  /**
   * Order dispatched notification
   */
  orderDispatched: (farmerId, orderId, trackingNumber) => ({
    type: 'ORDER_DISPATCHED',
    severity: 'info',
    title: 'Order Shipped',
    message: `Your order ${orderId} has been dispatched (Tracking: ${trackingNumber})`,
    targetUserId: farmerId,
    data: { orderId, trackingNumber },
  }),

  /**
   * Order delivered notification
   */
  orderDelivered: (farmerId, orderId) => ({
    type: 'ORDER_DELIVERED',
    severity: 'success',
    title: 'Order Delivered',
    message: `Order ${orderId} has been delivered to you`,
    targetUserId: farmerId,
    data: { orderId },
  }),

  /**
   * Negotiation created notification
   */
  negotiationCreated: (farmerId, ownerId, negotiationId, quantity, initialPrice) => ({
    type: 'NEGOTIATION_CREATED',
    severity: 'info',
    title: 'New Negotiation Request',
    message: `Negotiation request for ${quantity} units at ${initialPrice} per unit`,
    targetUserId: ownerId,
    isAdminAlert: false,
    data: { negotiationId, farmerId, ownerId, quantity, initialPrice },
  }),

  /**
   * Negotiation accepted notification
   */
  negotiationAccepted: (farmerId, negotiationId, finalPrice) => ({
    type: 'NEGOTIATION_ACCEPTED',
    severity: 'success',
    title: 'Negotiation Accepted',
    message: `Your negotiation has been accepted at ${finalPrice} per unit`,
    targetUserId: farmerId,
    data: { negotiationId, finalPrice },
  }),

  /**
   * Order conflict reported notification
   */
  conflictReported: (orderId, conflictReason, conflictType) => ({
    type: 'ORDER_CONFLICT',
    severity: 'warning',
    title: 'Order Conflict Reported',
    message: `Conflict on order ${orderId}: ${conflictReason}`,
    isAdminAlert: true,
    data: { orderId, conflictReason, conflictType },
  }),

  /**
   * Conflict resolved notification
   */
  conflictResolved: (orderId, refundAmount) => ({
    type: 'CONFLICT_RESOLVED',
    severity: 'info',
    title: 'Conflict Resolved',
    message: `Order ${orderId} conflict resolved. Refund: ${refundAmount}`,
    isAdminAlert: true,
    data: { orderId, refundAmount },
  }),

  /**
   * Payment failed notification
   */
  paymentFailed: (ownerId, orderId, reason) => ({
    type: 'PAYMENT_FAILED',
    severity: 'error',
    title: 'Payment Failed',
    message: `Payment for order ${orderId} failed: ${reason}`,
    targetUserId: ownerId,
    isAdminAlert: true,
    data: { orderId, reason },
  }),

  /**
   * System alert notification
   */
  systemAlert: (alertType, message, severity = 'warning') => ({
    type: 'SYSTEM_ALERT',
    severity,
    title: 'System Alert',
    message,
    isAdminAlert: true,
    data: { alertType },
  }),

  /**
   * Low stock alert
   */
  lowStockAlert: (productId, productName, availableStock) => ({
    type: 'LOW_STOCK',
    severity: 'warning',
    title: 'Low Stock Alert',
    message: `Product "${productName}" has only ${availableStock} units remaining`,
    isAdminAlert: true,
    data: { productId, productName, availableStock },
  }),
};

module.exports = {
  notificationQueue,
  createNotification,
};
