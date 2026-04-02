# Phase 3: The Negotiation Engine (Core Domain)

**Status**: ✅ COMPLETED

**Goal**: Build the stateful, realtime negotiation loop which is the primary differentiator of the product.

---

## 3.1 ✅ Negotiation State Machine

### Strict State Transitions

The negotiation system enforces deterministic, explicit state transitions with no exceptions:

```
INITIATED → ACTIVE → ACCEPTED
                  ↘ REJECTED ↗
                    EXPIRED
```

**Key Rules**:
- ✅ Only valid transitions allowed (no skipping states)
- ✅ Cannot accept/reject expired negotiations
- ✅ Cannot modify negotiations in ACCEPTED state
- ✅ EXPIRED state prevents further changes
- ✅ All state changes logged with timestamps

### State Definitions

| State | Description | Allowed Transitions | Who | Actions |
|-------|-------------|------------------|-----|---------|
| **INITIATED** | Negotiation created by Farmer | ACTIVE | Owner | Activate to start messaging |
| **ACTIVE** | Messaging & offers exchanged | ACCEPTED, REJECTED, EXPIRED | Both | Send messages, counter offers |
| **ACCEPTED** | Deal accepted, order created | None | Owner | ✓ Locked, order proceeds |
| **REJECTED** | Negotiation declined | None | Both | ✓ Locked, no reversion |
| **EXPIRED** | Exceeded 7-day window | None | System | ✓ Auto-expired, locked |

### Transition Validation

**Controller**: `negotiationController.js`

```javascript
// Strict state machine validation
const VALID_TRANSITIONS = {
  INITIATED: ['ACTIVE'],
  ACTIVE: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
};

const isValidTransition = (currentState, newState) => {
  return VALID_TRANSITIONS[currentState]?.includes(newState) || false;
};
```

---

## 3.2 ✅ Real-time Communication

### Socket.io Integration

**Location**: `src/utils/socket.js`

Enables instant messaging between Farmer and Owner within ACTIVE negotiations.

#### Authentication
```javascript
// Token-based authentication on connect
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const decoded = verifyToken(token);
  socket.userId = decoded.userId;
  socket.userRole = decoded.role;
  next();
});
```

#### Socket Events

##### 1. Join Negotiation
**Event**: `join_negotiation`

```javascript
// Client
socket.emit('join_negotiation', { negotiationId: 'NEGOTIATION_ID' });

// Server response
socket.on('user_joined', (data) => {
  console.log(`${data.userRole} joined negotiation`);
});
```

**Validation**:
- ✅ User must be farmer or owner of negotiation
- ✅ Negotiation must be in ACTIVE state
- ✅ Only messaging allowed in ACTIVE state

##### 2. Send Message
**Event**: `send_message`

```javascript
// Client
socket.emit('send_message', {
  negotiationId: 'NEGOTIATION_ID',
  content: 'Can you offer a discount for bulk order?',
});

// Server broadcasts to both parties
socket.on('new_message', (data) => {
  console.log(`New message: ${data.message.content}`);
});
```

**Features**:
- ✅ Messages saved to negotiation history
- ✅ Timestamp automatically added
- ✅ Sender role tracked
- ✅ Real-time delivery to both parties

##### 3. Send Counter Offer
**Event**: `send_offer`

```javascript
// Client
socket.emit('send_offer', {
  negotiationId: 'NEGOTIATION_ID',
  quantity: 500,
  pricePerUnit: 480,
});

// Server broadcasts
socket.on('new_offer', (data) => {
  console.log(`Counter-offer: ${data.offer.quantity}kg @ ₹${data.offer.pricePerUnit}`);
});
```

**Features**:
- ✅ Offers tracked as current offer
- ✅ Both parties notified instantly
- ✅ Offer history preserved

##### 4. Leave Negotiation
**Event**: `leave_negotiation`

```javascript
socket.emit('leave_negotiation', { negotiationId: 'NEGOTIATION_ID' });
```

#### Fallback & Polling

While Socket.io handles real-time messaging, REST endpoints provide polling fallback:

```bash
# Fallback: Poll for new messages
curl "http://localhost:5000/api/negotiations/NEGOTIATION_ID" \
  -H "Authorization: Bearer TOKEN"
```

---

## 3.3 ✅ Expiry Flow & Guardrails

### Background Expiry Worker

**Location**: `src/utils/expiryWorker.js`

Automatically scans and expires old negotiations.

#### Configuration
- **Runs Every**: 5 minutes
- **Expiry Window**: 7 days from creation
- **Action**: Updates ACTIVE negotiations with `expiresAt < now` to EXPIRED state

#### Startup
```javascript
// Server startup - starts worker
startExpiryWorker();

// Worker logs
✓ Starting negotiation expiry worker (runs every 5 minutes)
✓ Expiry check complete - no negotiations to expire
✓ Expired 2 negotiations
```

#### Implementation
```javascript
const expireNegotiations = async () => {
  const now = new Date();
  
  // Find expired ACTIVE negotiations
  const result = await Negotiation.updateMany(
    {
      state: 'ACTIVE',
      expiresAt: { $lt: now },
    },
    { $set: { state: 'EXPIRED' } }
  );
  
  console.log(`✓ Expired ${result.modifiedCount} negotiations`);
};

// Run every 5 minutes
setInterval(expireNegotiations, 5 * 60 * 1000);
```

### Rate Limiting

**Location**: `src/middleware/rateLimit.js`

Prevents spam and abuse by limiting negotiation creation.

#### Configuration
- **Window**: 1 hour
- **Limit**: 10 negotiations per hour per user
- **Bypass**: Admins exempt

```javascript
const negotiationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many negotiations created. Try again later.',
  keyGenerator: (req) => req.user?.userId,
  skip: (req) => req.user?.role === 'ADMIN',
});
```

#### Applied To
- `POST /api/negotiations` - Create negotiation

---

## API Endpoints

### Create Negotiation (Farmer)
**Route**: `POST /api/negotiations`
**Auth**: Required (FARMER)
**Rate Limit**: 10 per hour
**Body**:
```json
{
  "productId": "PRODUCT_ID",
  "quantity": 500,
  "initialPrice": 450
}
```

**Response**:
```json
{
  "message": "Negotiation initiated",
  "negotiation": {
    "id": "...",
    "productId": "...",
    "state": "INITIATED",
    "initialQuantity": 500,
    "initialPrice": 450,
    "expiresAt": "2026-04-09T..."
  }
}
```

### Get Negotiation Details
**Route**: `GET /api/negotiations/:id`
**Auth**: Not required

```bash
curl http://localhost:5000/api/negotiations/NEGOTIATION_ID
```

**Response**: Full negotiation with messages & offers

### Get Farmer's Negotiations
**Route**: `GET /api/negotiations/farmer/list`
**Auth**: Required (FARMER)
**Query Params**: page, limit, state

```bash
curl "http://localhost:5000/api/negotiations/farmer/list?state=ACTIVE" \
  -H "Authorization: Bearer TOKEN"
```

### Get Owner's Negotiations
**Route**: `GET /api/negotiations/owner/list`
**Auth**: Required (OWNER)
**Query Params**: page, limit, state

```bash
curl "http://localhost:5000/api/negotiations/owner/list?page=1&limit=20" \
  -H "Authorization: Bearer TOKEN"
```

### Activate Negotiation (Owner)
**Route**: `PUT /api/negotiations/:negotiationId/activate`
**Auth**: Required (OWNER)

Moves negotiation from INITIATED → ACTIVE to enable messaging.

```bash
curl -X PUT http://localhost:5000/api/negotiations/NEGOTIATION_ID/activate \
  -H "Authorization: Bearer TOKEN"
```

**Response**:
```json
{
  "message": "Negotiation activated - ready for messaging",
  "negotiation": { "id": "...", "state": "ACTIVE" }
}
```

### Accept Negotiation (Owner)
**Route**: `PUT /api/negotiations/:negotiationId/accept`
**Auth**: Required (OWNER)
**Body**:
```json
{
  "quantity": 500,
  "finalPrice": 480
}
```

Moves negotiation to ACCEPTED and creates order.

```bash
curl -X PUT http://localhost:5000/api/negotiations/NEGOTIATION_ID/accept \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 500, "finalPrice": 480}'
```

**Response**:
```json
{
  "message": "Negotiation accepted and order created",
  "order": {
    "id": "ORDER_ID",
    "quantity": 500,
    "pricePerUnit": 480,
    "totalAmount": 240000
  }
}
```

### Reject Negotiation
**Route**: `PUT /api/negotiations/:negotiationId/reject`
**Auth**: Required (FARMER, OWNER)
**Body**:
```json
{
  "reason": "Price too high"
}
```

```bash
curl -X PUT http://localhost:5000/api/negotiations/NEGOTIATION_ID/reject \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Price expectations not met"}'
```

---

## Socket.io Client Example

### JavaScript (Frontend)

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'YOUR_JWT_TOKEN',
  },
});

// Join negotiation
socket.emit('join_negotiation', { negotiationId: 'NEGOTIATION_ID' });

// Listen for user joined
socket.on('user_joined', (data) => {
  console.log(`${data.userRole} joined the negotiation`);
});

// Send message
socket.emit('send_message', {
  negotiationId: 'NEGOTIATION_ID',
  content: 'Can we negotiate on price?',
});

// Listen for new messages
socket.on('new_message', (data) => {
  console.log(`${data.message.senderRole}: ${data.message.content}`);
});

// Send counter offer
socket.emit('send_offer', {
  negotiationId: 'NEGOTIATION_ID',
  quantity: 500,
  pricePerUnit: 480,
});

// Listen for offers
socket.on('new_offer', (data) => {
  console.log(
    `Offer: ${data.offer.quantity}kg @ ₹${data.offer.pricePerUnit}`,
  );
});

// Listen for errors
socket.on('error', (data) => {
  console.error(data.message);
});
```

---

## Architecture Overview

```
backend/src/
├── controllers/
│   ├── negotiationController.js    ✓ State machine + CRUD
│   └── (3 from Phase 1-2)
├── middleware/
│   ├── auth.js                    ✓ Phase 1
│   ├── upload.js                  ✓ Phase 2
│   └── rateLimit.js               ✓ Phase 3 (NEW)
├── routes/
│   ├── negotiationRoutes.js       ✓ Phase 3 (NEW)
│   └── (3 from Phase 1-2)
├── utils/
│   ├── auth.js                    ✓ Phase 1
│   ├── db.js                      ✓ Phase 1
│   ├── socket.js                  ✓ Phase 3 (NEW)
│   └── expiryWorker.js            ✓ Phase 3 (NEW)
└── models/
    └── (5 schemas - Negotiation ✓ used here)
```

---

## Key Features Implemented

### 1. Deterministic State Machine
✅ Strict transitions enforced
✅ No invalid state changes
✅ Immutable accepted negotiations
✅ Auto-expiry after 7 days

### 2. Real-time Messaging
✅ Socket.io for instant communication
✅ Token-based authentication
✅ Messages persisted to database
✅ Offer tracking
✅ User presence indicators

### 3. Abuse Prevention
✅ Rate limiting (10 negotiations/hour/user)
✅ Admins bypass limits
✅ 7-day expiry prevents stale negotiations
✅ Background worker for cleanup

### 4. Fallback Resilience
✅ REST endpoints for polling
✅ Socket.io with WebSocket + fallbacks
✅ Message persistence for recovery

---

## Files Created in Phase 3

### Controllers
- `src/controllers/negotiationController.js` - State machine, 6 operations

### Middleware
- `src/middleware/rateLimit.js` - Rate limiting config

### Routes
- `src/routes/negotiationRoutes.js` - Negotiation endpoints

### Utilities
- `src/utils/socket.js` - Socket.io event handlers
- `src/utils/expiryWorker.js` - Background expiry worker

### Updates
- `src/server.js` - HTTP server, Socket.io integration, worker startup
- `seeds/seed.js` - Added sample users, products, negotiations

---

## Testing Checklist

### 1. State Machine
- [ ] Create negotiation (INITIATED)
- [ ] Activate negotiation (INITIATED → ACTIVE)
- [ ] Try invalid transition (should fail)
- [ ] Accept negotiation (ACTIVE → ACCEPTED, creates order)
- [ ] Reject negotiation (ACTIVE → REJECTED)
- [ ] Try invalid state after ACCEPTED (should fail)
- [ ] Wait 7 days, verify auto-expiry (ACTIVE → EXPIRED)

### 2. Real-time Messaging
- [ ] Connect with valid token
- [ ] Join negotiation
- [ ] Send message from both parties
- [ ] Receive message in real-time
- [ ] Send counter offer
- [ ] Verify offer persisted
- [ ] Disconnect gracefully

### 3. Rate Limiting
- [ ] Create 1st negotiation (success)
- [ ] Create 10 negotiations quickly (success)
- [ ] Create 11th negotiation (rate limit error)
- [ ] Wait 1 hour, try again (success)
- [ ] Admin bypass test (success without limit)

### 4. Expiry Worker
- [ ] Create negotiation
- [ ] Wait 5 minutes for worker run
- [ ] Manually update expiresAt to past
- [ ] Worker should expire it
- [ ] Verify state is EXPIRED

---

## Database Seed Data

**Command**: `npm run seed`

Creates:
- **Users**: 1 Farmer, 1 Owner, 1 Admin
- **Products**: 3 sample products
- **Inventory**: Stock data for each product
- **Negotiations**: 1 sample in INITIATED state

```
Farmer: farmer@example.com / password123
Owner:  owner@example.com / password123
Admin:  admin@example.com / password123
```

---

## Next Steps

Phase 3 is feature-complete! The negotiation engine now:
- ✅ Controls state strictly
- ✅ Enables real-time messaging
- ✅ Prevents abuse
- ✅ Auto-expires stale negotiations
- ✅ Creates orders on acceptance

**Remaining Phases**:
- **Phase 4**: Order Lifecycle & Fulfillment
- **Phase 5**: Administration & Observability
- **Phase 6**: Future Enhancements

---

## Verification

```bash
# Start server
npm run dev

# Seed database
npm run seed

# Test endpoint
curl http://localhost:5000/api/health
```

**Expected**: All Phase 3 endpoints available + Socket.io connected
