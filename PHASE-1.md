# Phase 1: Foundation & Architecture Setup

**Status**: ✅ COMPLETED

**Goal**: Establish the core technical infrastructure, environments, and basic data models.

---

## 1.1 ✅ Environment Setup & Tooling

### Completed
- [x] Frontend (React) initialized with basic app structure
- [x] Backend (Express/Node.js) set up with modular architecture
- [x] DX commands configured (`npm run dev`, `npm run seed`)
- [x] Environment variables configured (`.env` files with examples)
- [x] Linting configured for both frontend and backend (ESLint)

### Details
```bash
# Development
npm run dev              # Run backend + frontend concurrently
npm run server          # Backend only
npm run client          # Frontend only

# Database
npm run seed            # Populate initial data

# Code Quality
npm run lint            # Check code style
npm run lint:fix        # Auto-fix issues
```

---

## 1.2 ✅ Database & Data Modeling

### MongoDB Schemas Created

#### User Schema
- Email (unique, validated)
- Password (hashed with bcrypt)
- Personal info (firstName, lastName, phone)
- Role (FARMER, OWNER, ADMIN)
- Address info (city, state, zipCode, fullAddress)
- Account status (isActive, isVerified, lastLogin)
- Timestamps (createdAt, updatedAt)

**Indexes**: email, role, createdAt

#### Product Schema
- Name, description, category
- Owner reference (ownerId)
- Base price, unit (kg, liter, bag, ton)
- Minimum order quantity
- Image URL
- Active status
- Timestamps

**Indexes**: ownerId, category, full-text search (name + description), createdAt

#### Inventory Schema
- Product reference (productId)
- Owner reference (ownerId)
- Available stock (min: 0)
- Reserved stock
- Sold stock
- Warehouse info
- Last restocked timestamp

**Indexes**: productId, ownerId, availableStock

#### Negotiation Schema (Core Domain)
- Farmer & Owner references
- Product reference
- State machine: INITIATED → ACTIVE → {ACCEPTED | REJECTED | EXPIRED}
- Initial quantity & price
- Current offer tracking
- Messages array (audit trail)
- Expiry & timestamps

**Indexes**: (farmerId, state), (ownerId, state), state, createdAt, expiresAt

#### Order Schema
- Farmer & Owner references
- Product reference
- Order state: CREATED → PENDING → APPROVED → DISPATCHED → DELIVERED
- Payment state: PENDING → PAID
- Quantity, price per unit, total amount
- Payment method (COD only for MVP)
- Shipping address
- Tracking number
- Cancellation tracking
- Idempotency key (prevents duplicate orders)

**Indexes**: (farmerId, createdAt), (ownerId, createdAt), orderState, paymentState, idempotencyKey

### Horizontal Scaling Ready
- All schemas use indexed fields for efficient querying
- Composite indexes for common multi-field queries
- Unique constraints where applicable
- Text search index for product discovery

---

## 1.3 ✅ Auth Service & Security

### JWT Authentication
- **Module**: `src/utils/auth.js`
- Token generation with 7-day expiry
- Token verification middleware
- Password hashing (bcryptjs with salt)
- Password comparison for login

### Role-Based Authorization
- **Middleware**: `src/middleware/auth.js`
- `authenticate()` - Validates JWT token
- `authorize(roles)` - Restricts access by role

### Auth Routes
- **Module**: `src/routes/authRoutes.js`

#### Public Endpoints
- `POST /api/auth/register` - Create new user
  - Required: email, password, firstName, lastName, role, phone
  - Returns: token + user info
  
- `POST /api/auth/login` - User login
  - Required: email, password
  - Returns: token + user info

#### Protected Endpoints
- `GET /api/auth/me` - Get current user (requires valid token)
  - Returns: current user info (password excluded)

### Controllers
- **Module**: `src/controllers/authController.js`
- `register()` - Handles user registration
  - Validates input
  - Checks for duplicate email
  - Validates role
  - Hashes password
  - Creates JWT token

- `login()` - Handles user login
  - Validates credentials
  - Updates lastLogin timestamp
  - Creates JWT token

- `getCurrentUser()` - Fetches authenticated user

---

## Architecture Overview

```
backend/
├── src/
│   ├── server.js                 ✓ Express app with routes
│   ├── models/
│   │   ├── User.js               ✓ User schema
│   │   ├── Product.js            ✓ Product schema
│   │   ├── Inventory.js          ✓ Inventory schema
│   │   ├── Negotiation.js        ✓ Negotiation schema
│   │   └── Order.js              ✓ Order schema
│   ├── routes/
│   │   └── authRoutes.js         ✓ Auth endpoints
│   ├── controllers/
│   │   └── authController.js     ✓ Auth business logic
│   ├── middleware/
│   │   └── auth.js               ✓ Auth middleware
│   └── utils/
│       ├── db.js                 ✓ Database connection
│       └── auth.js               ✓ JWT & password utilities
├── seeds/
│   └── seed.js                   ✓ Database seeding script
└── .eslintrc.json                ✓ Linting config
```

---

## Testing the Implementation

### Start the Server
```bash
# Ensure MongoDB is running
mongod

# Start backend
npm run server
```

### Register a User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "farmer@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe",
    "role": "FARMER",
    "phone": "1234567890"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "farmer@example.com",
    "password": "password123"
  }'
```

### Get Current User
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Key Features Implemented

✅ **Deterministic State Machines**
- Negotiation & Order states strictly enforced
- Invalid transitions blocked at schema level

✅ **Strong Backend Guarantees**
- Inventory minimum constraint (never below zero)
- Unique email constraint
- Role-based authorization

✅ **Data Integrity**
- Password hashing with bcrypt
- JWT token-based authentication
- Audit trails (timestamps on all models)
- Idempotency keys for order creation

✅ **Scalability Ready**
- Proper indexing for high-volume queries
- Modular architecture
- Horizontal scaling-ready database design

✅ **Security**
- Passwords never stored in plain text
- JWT tokens with expiry
- Role-based access control
- Input validation on all endpoints

---

## Next Steps: Phase 2

Phase 2 will implement:
1. Product CRUD operations
2. Inventory management
3. Direct purchase flow (no negotiation)
4. File uploads (Multer) for product images
5. Product browsing for farmers

---

## Verification

Run the verification script:
```bash
npm run verify
```

Expected output:
```
✓ All checks passed!
```

Check the health endpoint:
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2026-04-02T...",
  "uptime": 12.345
}
```
