require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { connectDB } = require('./utils/db');
const { initializeSocketHandlers } = require('./utils/socket');
const { startExpiryWorker } = require('./utils/expiryWorker');

// Import routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const negotiationRoutes = require('./routes/negotiationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const phase6Routes = require('./routes/phase6Routes'); // Phase 6: Analytics, webhooks, fraud detection

// Import middleware
const { performanceMonitor } = require('./middleware/performanceMonitor');
const { auditMiddleware } = require('./middleware/auditLogger'); // Phase 6: Audit logging

// Import services
const { notificationQueue } = require('./services/notificationService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(performanceMonitor); // Phase 5: Performance monitoring
app.use(auditMiddleware); // Phase 6: Audit logging
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Connect MongoDB
connectDB().catch((err) => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});

// Start background workers
startExpiryWorker();

// Health Check Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/negotiations', negotiationRoutes);
app.use('/api/admin', adminRoutes); // Phase 5: Admin dashboard & monitoring
app.use('/api', phase6Routes); // Phase 6: Analytics, webhooks, fraud detection, audit logs

// Socket.io event handlers
initializeSocketHandlers(io);

// Make services accessible to routes if needed
app.set('io', io);
app.set('notificationQueue', notificationQueue); // Phase 5: Notifications

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error Handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/api/health`);
  console.log(`✓ Auth endpoints: http://localhost:${PORT}/api/auth`);
  console.log(`✓ Product endpoints: http://localhost:${PORT}/api/products`);
  console.log(`✓ Inventory endpoints: http://localhost:${PORT}/api/inventory`);
  console.log(`✓ Order endpoints: http://localhost:${PORT}/api/orders`);
  console.log(`✓ Negotiation endpoints: http://localhost:${PORT}/api/negotiations`);
  console.log(`✓ Admin endpoints: http://localhost:${PORT}/api/admin`);
  console.log('✓ WebSocket (Socket.io) ready for real-time negotiation');
  console.log('✓ Performance monitoring active');
  console.log('✓ Notification service ready');
  console.log(`✓ Phase 6 - Seller Analytics: http://localhost:${PORT}/api/analytics`);
  console.log(`✓ Phase 6 - Webhooks: http://localhost:${PORT}/api/webhooks`);
  console.log(`✓ Phase 6 - Fraud Detection: http://localhost:${PORT}/api/fraud-records`);
  console.log(`✓ Phase 6 - Audit Logs: http://localhost:${PORT}/api/audit-logs`);
});

module.exports = server;
