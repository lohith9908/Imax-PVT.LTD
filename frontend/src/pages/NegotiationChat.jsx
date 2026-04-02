import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getSocket } from '../services/socketClient';
import apiClient from '../services/apiClient';

export default function NegotiationChat() {
  const { user, logout } = useAuth();
  const [negotiations, setNegotiations] = useState([]);
  const [selectedNegotiation, setSelectedNegotiation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [socketStatus, setSocketStatus] = useState('Connecting...');
  const messagesEndRef = useRef(null);

  // Initialize socket connection and listen for events
  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      setSocketStatus('Connected');
    };

    const handleDisconnect = () => {
      setSocketStatus('Disconnected - Reconnecting...');
    };

    const handleNewNegotiation = (negotiation) => {
      setNegotiations((prev) => [negotiation, ...prev]);
    };

    const handleNegotiationUpdate = (updatedNegotiation) => {
      setNegotiations((prev) =>
        prev.map((n) => (n._id === updatedNegotiation._id ? updatedNegotiation : n))
      );
      if (selectedNegotiation?._id === updatedNegotiation._id) {
        setSelectedNegotiation(updatedNegotiation);
      }
    };

    const handleNewMessage = (message) => {
      if (selectedNegotiation?._id === message.negotiationId) {
        setMessages((prev) => [...prev, message]);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('negotiation:new', handleNewNegotiation);
    socket.on('negotiation:update', handleNegotiationUpdate);
    socket.on('message:new', handleNewMessage);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('negotiation:new', handleNewNegotiation);
      socket.off('negotiation:update', handleNegotiationUpdate);
      socket.off('message:new', handleNewMessage);
    };
  }, [selectedNegotiation]);

  // Fetch negotiations
  useEffect(() => {
    fetchNegotiations();
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchNegotiations = async () => {
    try {
      const { data } = await apiClient.get('/negotiations');
      setNegotiations(data);
    } catch (err) {
      console.error('Failed to fetch negotiations:', err);
      setError('Failed to load negotiations');
    }
  };

  const handleSelectNegotiation = async (negotiation) => {
    setSelectedNegotiation(negotiation);
    setMessages([]);
    setNewMessage('');
    try {
      const { data } = await apiClient.get(`/negotiations/${negotiation._id}/messages`);
      setMessages(data);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const socket = getSocket();
      const messageData = {
        negotiationId: selectedNegotiation._id,
        content: newMessage,
        sender: user._id,
      };
      socket.emit('message:send', messageData);
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message');
    }
  };

  const handleSubmitOffer = async (e) => {
    e.preventDefault();
    if (!offerPrice || !quantity) return;

    try {
      setLoading(true);
      const socket = getSocket();
      socket.emit('negotiation:offer', {
        negotiationId: selectedNegotiation._id,
        offeredPrice: parseFloat(offerPrice),
        quantity: parseInt(quantity),
      });
      setOfferPrice('');
      setQuantity('');
    } catch (err) {
      console.error('Failed to submit offer:', err);
      setError('Failed to submit offer');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      INITIATED: 'bg-yellow-100 text-yellow-800',
      ACTIVE: 'bg-blue-100 text-blue-800',
      ACCEPTED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      EXPIRED: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || colors.INITIATED;
  };

  const getStatusIcon = (status) => {
    const icons = {
      INITIATED: '◐',
      ACTIVE: '●',
      ACCEPTED: '✓',
      REJECTED: '✕',
      EXPIRED: '⌛',
    };
    return icons[status] || '◐';
  };

  const isNegotiationActive = selectedNegotiation?.status === 'ACTIVE';
  const isReadOnly = !['ACTIVE', 'INITIATED'].includes(selectedNegotiation?.status);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar - Negotiations List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-brand-600">IMAX</h1>
            <button
              onClick={logout}
              className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200 transition"
            >
              Logout
            </button>
          </div>
          <div className="text-sm">
            <p className="text-gray-600">
              Welcome, <strong>{user?.firstName}</strong>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Role: <span className="font-medium">{user?.role}</span>
            </p>
          </div>
          <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-gray-600">
            🌐 {socketStatus}
          </div>
        </div>

        {/* Negotiations List */}
        <div className="flex-1 overflow-y-auto">
          {negotiations.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No negotiations yet. Start negotiating!
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {negotiations.map((negotiation) => (
                <motion.button
                  key={negotiation._id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => handleSelectNegotiation(negotiation)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    selectedNegotiation?._id === negotiation._id
                      ? 'bg-brand-50 border-l-4 border-brand-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm truncate">
                        {negotiation.productId?.name || 'Product'}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Qty: {negotiation.quantity} | ₹{negotiation.offeredPrice}
                      </p>
                    </div>
                    <motion.span
                      animate={{ scale: negotiation.status === 'ACTIVE' ? [1, 1.1, 1] : 1 }}
                      transition={{ repeat: negotiation.status === 'ACTIVE' ? Infinity : 0, duration: 1 }}
                      className={`badge text-xs whitespace-nowrap ml-2 ${getStatusColor(negotiation.status)}`}
                    >
                      {getStatusIcon(negotiation.status)} {negotiation.status}
                    </motion.span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(negotiation.createdAt).toLocaleDateString()}
                  </p>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Chat */}
      <div className="flex-1 flex flex-col">
        {selectedNegotiation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  {selectedNegotiation.productId?.name}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedNegotiation.quantities?.join(', ')} units
                  {selectedNegotiation.expiresAt && (
                    <>
                      {' '}
                      • Expires:{' '}
                      {new Date(selectedNegotiation.expiresAt).toLocaleTimeString()}
                    </>
                  )}
                </p>
              </div>
              <motion.span
                animate={{ scale: isNegotiationActive ? [1, 1.1, 1] : 1 }}
                transition={{ repeat: isNegotiationActive ? Infinity : 0, duration: 1 }}
                className={`badge px-4 py-2 ${getStatusColor(selectedNegotiation.status)}`}
              >
                {getStatusIcon(selectedNegotiation.status)} {selectedNegotiation.status}
              </motion.span>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <AnimatePresence>
                {messages.map((message, idx) => {
                  const isMine = message.senderId === user._id;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: isMine ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: isMine ? 20 : -20 }}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`message-bubble ${
                          isMine ? 'message-bubble-mine' : 'message-bubble-theirs'
                        }`}
                      >
                        {message.type === 'offer' ? (
                          <div className="font-medium">
                            💰 Offer: ₹{message.offeredPrice} for {message.quantity} units
                          </div>
                        ) : (
                          <p>{message.content}</p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Offer Section */}
            {isNegotiationActive && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-blue-50 border-t border-blue-200 p-4"
              >
                <form onSubmit={handleSubmitOffer} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      className="input"
                      placeholder="Price"
                      value={offerPrice}
                      onChange={(e) => setOfferPrice(e.target.value)}
                      step="0.01"
                      disabled={loading}
                    />
                    <input
                      type="number"
                      className="input"
                      placeholder="Quantity"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !offerPrice || !quantity}
                    className="w-full btn-primary py-2"
                  >
                    {loading ? '⏳ Submitting...' : '💼 Submit Offer'}
                  </button>
                </form>
              </motion.div>
            )}

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="bg-white border-t border-gray-200 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder={
                    isReadOnly ? 'Negotiation is closed' : 'Type a message...'
                  }
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={isReadOnly}
                />
                <button
                  type="submit"
                  disabled={isReadOnly || !newMessage.trim()}
                  className="btn-primary px-4 py-2"
                >
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <p>Select a negotiation to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
