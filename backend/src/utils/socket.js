const Negotiation = require('../models/Negotiation');
const { verifyToken } = require('../utils/auth');

// Socket.io event handlers for real-time negotiation messaging
const initializeSocketHandlers = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('No token provided'));
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return next(new Error('Invalid token'));
    }

    socket.userId = decoded.userId;
    socket.userRole = decoded.role;
    next();
  });

  io.on('connection', (socket) => {
    console.log(`✓ User connected: ${socket.userId} (${socket.userRole})`);

    // Join negotiation room
    socket.on('join_negotiation', async (data) => {
      const { negotiationId } = data;

      try {
        const negotiation = await Negotiation.findById(negotiationId);
        if (!negotiation) {
          socket.emit('error', { message: 'Negotiation not found' });
          return;
        }

        // Verify user is part of negotiation
        const isFarmer = negotiation.farmerId.toString() === socket.userId;
        const isOwner = negotiation.ownerId.toString() === socket.userId;
        if (!isFarmer && !isOwner) {
          socket.emit('error', { message: 'Not authorized to join this negotiation' });
          return;
        }

        // Only allow messaging if negotiation is ACTIVE
        if (negotiation.state !== 'ACTIVE') {
          socket.emit('error', { message: `Cannot message in ${negotiation.state} state` });
          return;
        }

        const room = `negotiation_${negotiationId}`;
        socket.join(room);

        io.to(room).emit('user_joined', {
          userId: socket.userId,
          userRole: socket.userRole,
          negotiationId,
        });

        console.log(`✓ User ${socket.userId} joined negotiation ${negotiationId}`);
      } catch (error) {
        console.error('Join negotiation error:', error);
        socket.emit('error', { message: 'Server error' });
      }
    });

    // Handle message
    socket.on('send_message', async (data) => {
      const { negotiationId, content } = data;

      try {
        const negotiation = await Negotiation.findById(negotiationId);
        if (!negotiation) {
          socket.emit('error', { message: 'Negotiation not found' });
          return;
        }

        // Verify state is ACTIVE
        if (negotiation.state !== 'ACTIVE') {
          socket.emit('error', { message: 'Cannot send messages - negotiation is not active' });
          return;
        }

        // Verify user is part of negotiation
        const isFarmer = negotiation.farmerId.toString() === socket.userId;
        const isOwner = negotiation.ownerId.toString() === socket.userId;
        if (!isFarmer && !isOwner) {
          socket.emit('error', { message: 'Not authorized' });
          return;
        }

        // Save message to negotiation
        const message = {
          senderId: socket.userId,
          senderRole: socket.userRole,
          content,
          timestamp: new Date(),
        };

        negotiation.messages.push(message);
        await negotiation.save();

        // Broadcast message to both parties
        const room = `negotiation_${negotiationId}`;
        io.to(room).emit('new_message', {
          negotiationId,
          message: {
            senderId: socket.userId,
            senderRole: socket.userRole,
            content,
            timestamp: message.timestamp,
          },
        });

        console.log(`✓ Message in negotiation ${negotiationId} from ${socket.userRole}`);
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Server error' });
      }
    });

    // Handle counter offer
    socket.on('send_offer', async (data) => {
      const { negotiationId, quantity, pricePerUnit } = data;

      try {
        const negotiation = await Negotiation.findById(negotiationId);
        if (!negotiation) {
          socket.emit('error', { message: 'Negotiation not found' });
          return;
        }

        // Verify state is ACTIVE
        if (negotiation.state !== 'ACTIVE') {
          socket.emit('error', { message: 'Cannot send offer - negotiation is not active' });
          return;
        }

        // Store current offer
        negotiation.currentOffer = {
          farmerId: socket.userId,
          quantity,
          pricePerUnit,
          timestamp: new Date(),
        };

        await negotiation.save();

        // Broadcast offer to both parties
        const room = `negotiation_${negotiationId}`;
        io.to(room).emit('new_offer', {
          negotiationId,
          offer: {
            senderId: socket.userId,
            senderRole: socket.userRole,
            quantity,
            pricePerUnit,
            timestamp: negotiation.currentOffer.timestamp,
          },
        });

        console.log(`✓ Counter-offer in negotiation ${negotiationId}`);
      } catch (error) {
        console.error('Send offer error:', error);
        socket.emit('error', { message: 'Server error' });
      }
    });

    // Leave negotiation
    socket.on('leave_negotiation', (data) => {
      const { negotiationId } = data;
      const room = `negotiation_${negotiationId}`;
      socket.leave(room);

      io.to(room).emit('user_left', {
        userId: socket.userId,
        negotiationId,
      });

      console.log(`✓ User ${socket.userId} left negotiation ${negotiationId}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`✓ User disconnected: ${socket.userId}`);
    });
  });
};

module.exports = { initializeSocketHandlers };
