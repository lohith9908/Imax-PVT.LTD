# Phase 2: Product & Base Inventory System

**Status**: ✅ COMPLETED

**Goal**: Allow Owners and Admins to populate the system and Farmers to browse, with strict inventory rules.

---

## 2.1 ✅ Product Service

### CRUD Operations for Product Management

#### Create Product
**Route**: `POST /api/products`
**Auth**: Required (OWNER, ADMIN)
**Multipart**: Yes (supports image)

```bash
curl -X POST http://localhost:5000/api/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "name=Urea Fertilizer" \
  -F "description=High quality nitrogen fertilizer" \
  -F "category=Nitrogen" \
  -F "basePrice=500" \
  -F "unit=kg" \
  -F "minOrderQuantity=50" \
  -F "image=@product.jpg"
```

**Response**:
```json
{
  "message": "Product created successfully",
  "product": {
    "id": "...",
    "name": "Urea Fertilizer",
    "category": "Nitrogen",
    "basePrice": 500,
    "imageUrl": "/uploads/image-1234567890.jpg"
  }
}
```

#### Get Product Details
**Route**: `GET /api/products/:id`
**Auth**: Not required

```bash
curl http://localhost:5000/api/products/PRODUCT_ID
```

**Response**:
```json
{
  "product": {
    "id": "...",
    "name": "Urea Fertilizer",
    "description": "...",
    "basePrice": 500,
    "unit": "kg",
    "ownerId": { ... },
    "imageUrl": "..."
  },
  "inventory": {
    "availableStock": 1000
  }
}
```

#### Get All Products (Browsing)
**Route**: `GET /api/products/all`
**Auth**: Not required
**Query Params**: page, limit, category, search

```bash
curl "http://localhost:5000/api/products/all?page=1&limit=20&category=Nitrogen"
curl "http://localhost:5000/api/products/all?search=urea"
```

**Response**:
```json
{
  "products": [
    {
      "id": "...",
      "name": "Urea Fertilizer",
      "basePrice": 500,
      "availableStock": 1000,
      "imageUrl": "..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

#### Update Product
**Route**: `PUT /api/products/:id`
**Auth**: Required (OWNER only if owner of product)
**Multipart**: Yes (optional image)

```bash
curl -X PUT http://localhost:5000/api/products/PRODUCT_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "name=Updated Name" \
  -F "basePrice=550" \
  -F "image=@new-image.jpg"
```

#### Delete Product (Soft Delete)
**Route**: `DELETE /api/products/:id`
**Auth**: Required (OWNER only)

```bash
curl -X DELETE http://localhost:5000/api/products/PRODUCT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Get Owner's Products
**Route**: `GET /api/products/owner/list`
**Auth**: Required (OWNER, ADMIN)
**Query Params**: page, limit

```bash
curl "http://localhost:5000/api/products/owner/list?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 2.2 ✅ Inventory Handling

### Strict Invariant: Stock Never Below Zero

#### Update Stock
**Route**: `PUT /api/inventory/update`
**Auth**: Required (OWNER, ADMIN)

```bash
curl -X PUT http://localhost:5000/api/inventory/update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PRODUCT_ID",
    "quantity": 5000
  }'
```

**Response**:
```json
{
  "message": "Stock updated successfully",
  "inventory": {
    "productId": "...",
    "availableStock": 5000,
    "lastRestocked": "2026-04-02T10:30:00Z"
  }
}
```

#### Get Inventory for Product
**Route**: `GET /api/inventory/:productId`
**Auth**: Not required

```bash
curl http://localhost:5000/api/inventory/PRODUCT_ID
```

**Response**:
```json
{
  "inventory": {
    "productId": "...",
    "availableStock": 5000,
    "reservedStock": 0,
    "soldStock": 1200,
    "warehouse": {
      "location": "...",
      "capacity": 10000
    },
    "lastRestocked": "..."
  }
}
```

#### Get Owner's Inventory
**Route**: `GET /api/inventory/owner/list`
**Auth**: Required (OWNER, ADMIN)
**Query Params**: page, limit

```bash
curl "http://localhost:5000/api/inventory/owner/list?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Key Features**:
- ✅ Inventory never goes below 0
- ✅ Automatic decrement on order creation
- ✅ Track sold vs available stock
- ✅ Warehouse location management
- ✅ Last restocked tracking

---

## 2.3 ✅ Direct Purchase Base

### Direct Purchase Flow (Bulk with Instant Order)

#### Create Direct Order (No Negotiation)
**Route**: `POST /api/orders/direct`
**Auth**: Required (FARMER)

```bash
curl -X POST http://localhost:5000/api/orders/direct \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PRODUCT_ID",
    "quantity": 500,
    "shippingAddress": {
      "city": "Bangalore",
      "state": "Karnataka",
      "zipCode": "560001",
      "fullAddress": "123 Farm Lane, Bangalore"
    }
  }'
```

**Response**:
```json
{
  "message": "Order created successfully",
  "order": {
    "id": "...",
    "productId": "...",
    "quantity": 500,
    "totalAmount": 250000,
    "orderState": "PENDING",
    "paymentState": "PENDING",
    "trackingNumber": null
  }
}
```

**Validations**:
- ✅ Stock must be available (≥ requested quantity)
- ✅ Respect minimum order quantity
- ✅ Inventory automatically decremented
- ✅ Idempotency key prevents duplicate orders
- ✅ Bulk pricing applied automatically

#### Get Farmer's Orders
**Route**: `GET /api/orders/farmer/list`
**Auth**: Required (FARMER)
**Query Params**: page, limit, status

```bash
curl "http://localhost:5000/api/orders/farmer/list?page=1&limit=20&status=PENDING" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Get Owner's Orders
**Route**: `GET /api/orders/owner/list`
**Auth**: Required (OWNER)
**Query Params**: page, limit, status

```bash
curl "http://localhost:5000/api/orders/owner/list?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Update Order State
**Route**: `PUT /api/orders/:orderId/state`
**Auth**: Required (OWNER only)

```bash
curl -X PUT http://localhost:5000/api/orders/ORDER_ID/state \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "orderState": "APPROVED" }'
```

**Valid State Transitions**:
- CREATED → PENDING → APPROVED → DISPATCHED → DELIVERED
- Any state → REJECTED (cancellation)

#### Confirm Payment (COD)
**Route**: `PUT /api/orders/:orderId/payment`
**Auth**: Required (OWNER only)

```bash
curl -X PUT http://localhost:5000/api/orders/ORDER_ID/payment \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:
```json
{
  "message": "Payment confirmed",
  "order": {
    "id": "...",
    "paymentState": "PAID"
  }
}
```

---

## Architecture Overview

```
backend/src/
├── controllers/
│   ├── authController.js          ✓ Phase 1
│   ├── productController.js       ✓ Phase 2 (NEW)
│   ├── inventoryController.js     ✓ Phase 2 (NEW)
│   └── orderController.js         ✓ Phase 2 (NEW)
├── middleware/
│   ├── auth.js                    ✓ Phase 1
│   └── upload.js                  ✓ Phase 2 (NEW - Multer)
├── routes/
│   ├── authRoutes.js              ✓ Phase 1
│   ├── productRoutes.js           ✓ Phase 2 (NEW)
│   ├── inventoryRoutes.js         ✓ Phase 2 (NEW)
│   └── orderRoutes.js             ✓ Phase 2 (NEW)
└── models/
    └── (5 schemas from Phase 1)
```

---

## Multer Configuration

**Location**: `src/middleware/upload.js`

**Features**:
- ✅ Local disk storage in `/uploads` folder
- ✅ Only image files allowed (jpeg, png, gif, webp)
- ✅ 5MB file size limit
- ✅ Unique file naming (prevents conflicts)
- ✅ Error handling for invalid files

**Supported Formats**:
- image/jpeg (.jpg, .jpeg)
- image/png (.png)
- image/gif (.gif)
- image/webp (.webp)

---

## Key Invariants & Rules

### 1. Inventory System
- ✅ **Never Below Zero**: Stock cannot go negative
- ✅ **Automatic Decrement**: Stock reduced on order creation
- ✅ **Tracking**: availableStock, reservedStock, soldStock

### 2. Direct Purchase
- ✅ **Instant Execution**: No negotiation, immediate order
- ✅ **Min Order Qty**: Enforced per product
- ✅ **Bulk Pricing**: Base price applied automatically
- ✅ **Idempotency**: Prevents duplicate orders

### 3. Order State Machine
Valid transitions:
```
CREATED → PENDING → APPROVED → DISPATCHED → DELIVERED
                  ↘ REJECTED ↗
```

### 4. Payment (COD Only)
- ✅ Payment state: PENDING → PAID
- ✅ Owner confirms payment upon receiving goods
- ✅ No online payment processing

---

## Testing Checklist

### 1. Product CRUD
- [ ] Create product with image upload
- [ ] Retrieve product by ID
- [ ] Browse all products with pagination
- [ ] Update product (with/without new image)
- [ ] Delete product (soft delete)
- [ ] List owner's products

### 2. Inventory Management
- [ ] Update stock (increase/maintain)
- [ ] Attempt stock < 0 (should fail)
- [ ] Get product inventory
- [ ] List owner's inventory
- [ ] Verify stock decrements on order

### 3. Direct Purchase
- [ ] Create order with sufficient stock
- [ ] Create order with insufficient stock (should fail)
- [ ] Create order below minimum qty (should fail)
- [ ] Verify idempotency key prevents duplicates
- [ ] Get farmer's orders
- [ ] Get owner's orders

### 4. Order State Management
- [ ] Update order from PENDING → APPROVED
- [ ] Reject order (any state)
- [ ] Confirm payment (COD)
- [ ] Verify state transitions are strict

---

## Files Created in Phase 2

### Controllers
- `src/controllers/productController.js` - Product CRUD
- `src/controllers/inventoryController.js` - Stock management
- `src/controllers/orderController.js` - Direct purchase + order mgmt

### Middleware
- `src/middleware/upload.js` - Multer file upload config

### Routes
- `src/routes/productRoutes.js` - Product endpoints
- `src/routes/inventoryRoutes.js` - Inventory endpoints
- `src/routes/orderRoutes.js` - Order endpoints

### Infrastructure
- `backend/uploads/` - Directory for uploaded images
- Updated `src/server.js` - Registered new routes + static file serving

---

## Next: Phase 3

Phase 3 will implement:
1. **Negotiation State Machine** - INITIATED → ACTIVE → {ACCEPTED | REJECTED | EXPIRED}
2. **Real-time Communication** - Socket.io integration
3. **Expiry Flow & Guardrails** - Background worker for expired negotiations
4. **Rate Limiting** - Prevent negotiation spam

This is the core differentiator of the IMAX platform!

---

## Verification

```bash
# Ensure all lint passes
npm run lint

# Start server
npm run dev

# Expected endpoints active:
# GET  /api/health
# POST /api/auth/register
# POST /api/auth/login
# GET  /api/auth/me
# POST /api/products
# GET  /api/products/all
# GET  /api/products/:id
# PUT  /api/products/:id
# DELETE /api/products/:id
# GET  /api/products/owner/list
# PUT  /api/inventory/update
# GET  /api/inventory/:productId
# GET  /api/inventory/owner/list
# POST /api/orders/direct
# GET  /api/orders/farmer/list
# GET  /api/orders/owner/list
# PUT  /api/orders/:orderId/state
# PUT  /api/orders/:orderId/payment
```

