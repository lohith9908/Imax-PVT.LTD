IMAX Fertilizer Pvt. Ltd – FAANG-Level Product Requirements Document (PRD)

(Upgraded Version of your original PRD )

1. Executive Summary
1.1 Product Overview

IMAX Fertilizer Marketplace is a multi-tenant, negotiation-first commerce platform designed to digitize fertilizer procurement for farmers while enabling sellers (owners) to optimize pricing dynamically.

Unlike traditional e-commerce:

Pricing is stateful and contextual
Orders are derived outcomes of negotiation state transitions
The system acts as a source of truth for all pricing decisions
1.2 Core Differentiation
Traditional Marketplace	IMAX Marketplace
Fixed pricing	Dynamic + negotiated pricing
Stateless checkout	Stateful negotiation lifecycle
Manual communication	Structured, auditable negotiation
First-come purchase	Rule-based decision system
1.3 Vision

Build a deterministic, scalable negotiation infrastructure where:

Every price is explainable
Every transaction is auditable
Every state transition is enforced by system rules
2. Problem Statement
2.1 Current Industry Gaps
Unstructured Negotiations
Conducted via phone/WhatsApp
No audit trail
Leads to disputes
Price Inconsistency
Same product, different buyers → different pricing
No visibility into fairness
Inventory Conflicts
Over-selling due to lack of centralized tracking
2.2 Opportunity

Create a system of record for:

Pricing
Negotiation
Order lifecycle
3. Product Principles (Non-Negotiable)
3.1 Determinism Over Heuristics

System decisions must be:

Reproducible
Explainable
Rule-driven (no AI/ML ambiguity)
3.2 State Machines Over Conditional Logic

All critical workflows must be:

Explicitly modeled
Transition-controlled
Invalid transitions must fail
3.3 Strong Backend Guarantees
UI can be optimistic
Backend must enforce invariants strictly
3.4 No Silent Failures

Every failure must:

Be logged
Be visible to user/system
Have retry or fallback
4. Goals & Success Metrics
4.1 North Star Metric

👉 GMV from Negotiated Orders

4.2 Input Metrics (Leading Indicators)
Negotiation initiation rate
Avg offers per negotiation
Farmer engagement time
Owner response latency
4.3 Output Metrics
Negotiation → Order conversion %
Time to Order (TTO)
Revenue per seller
Repeat purchase rate
4.4 Guardrail Metrics
Stock conflict rate
Expired negotiation %
Order cancellation rate (COD risk)
Owner inactivity rate
5. System Constraints & Trade-offs
5.1 Payments (COD Only)

Decision: No online payments

Pros:

Simpler architecture
Higher adoption in rural areas

Cons:

Higher cancellation risk
No upfront commitment
5.2 Inventory Strategy

Decision: No stock reservation during negotiation

Why:

Prevent abuse (fake negotiations)
Ensure system scalability

Trade-off:

Possible order failure at final stage
5.3 Negotiation Expiry

Decision: Configurable per product

Impact:

Enables seller control
Adds system complexity (accepted)
5.4 Single Shop per Order

Decision: One shop per order

Why:

Simplifies logistics
Reduces cross-vendor dependencies
6. User Personas (Behavioral Modeling)
6.1 Farmer (Demand Side)
Highly price-sensitive
Prefers negotiation
Low patience for delays
6.2 Owner (Supply Side)
Profit optimizer
Needs fast decision-making tools
Sensitive to inventory turnover
6.3 Admin (System Authority)
Monitors anomalies
Controls platform integrity
Requires full observability
7. Core Domain Model (Critical)
7.1 System Invariants
A negotiation must always have:
expiry
ownerId
productId
An order must:
originate from either:
direct purchase OR
accepted negotiation
Inventory must:
never go below zero
8. State Machines (Strictly Enforced)
8.1 Negotiation State Machine
INITIATED → ACTIVE → 
   {ACCEPTED | REJECTED | EXPIRED}
Rules:
Cannot accept expired negotiation
Cannot modify accepted negotiation
Messages allowed only in ACTIVE
8.2 Order State Machine
CREATED → PENDING → APPROVED → DISPATCHED → DELIVERED
                  ↘ REJECTED
8.3 Payment State Machine
PENDING → PAID (COD confirmation)
9. Detailed User Flows
9.1 Negotiated Purchase Flow
Farmer selects product
Inputs:
quantity
offer price
Backend validates:
stock > 0
negotiation enabled
Negotiation created with expiry
Real-time chat (Socket.io)
Agreement reached
Order created with locked price
9.2 Direct Purchase Flow
Farmer selects product
Bulk pricing applied
Order placed directly
9.3 Expiry Flow
Background worker:
scans expired negotiations
updates state → EXPIRED
UI reflects instantly
10. Functional Requirements
10.1 Negotiation Engine
Inputs:
offerPrice
quantity
minAcceptablePrice
bulk pricing rules
Outputs:
auto-accept
auto-reject
escalate to owner
10.2 Concurrency Handling
Scenario:

Multiple farmers negotiating same product

Strategy:
No locking
Conflict resolved at order creation
10.3 Failure Modes
Scenario	System Behavior
Owner inactive	negotiation expires
Stock becomes 0	order blocked
Socket failure	fallback polling
Duplicate requests	idempotency keys
11. Non-Functional Requirements
11.1 Scalability
Stateless APIs
Horizontal scaling ready
MongoDB indexing strategy required
11.2 Consistency
Component	Consistency
Orders	Strong
Inventory	Strong
Analytics	Eventual
11.3 Performance Targets
API latency: < 300ms
Real-time updates: < 1s
11.4 Security
JWT authentication
Role-based authorization
Rate limiting (prevent spam negotiations)
12. System Architecture
12.1 Layers
Frontend: React
Backend: Express (Node.js)
Database: MongoDB (Compass)
Realtime: Socket.io
File Upload: Multer (local storage)
12.2 Services
Auth Service
Product Service
Negotiation Service
Order Service
Notification Service
13. Data Model (Refined)
Negotiation Schema
{
  "productId": "",
  "buyerId": "",
  "ownerId": "",
  "offeredPrice": "",
  "quantity": "",
  "messages": [],
  "status": "",
  "expiresAt": ""
}
Key Insight

👉 Negotiation = Transaction Builder, not chat

14. Configuration & Environment
Principles
No hardcoding
Fail-fast system
Environment parity
.env Example
PORT=
MONGO_URI=
JWT_SECRET=

ADMIN_EMAIL=
ADMIN_PASSWORD=
OWNER_EMAIL=
OWNER_PASSWORD=

NEGOTIATION_DEFAULT_EXPIRY=
UPLOAD_PATH=
15. Developer Experience (DX)
Goals:
Setup < 5 minutes
Deterministic environment
Commands:
npm run dev
npm run seed
16. Risks & Mitigation
Risk: Fake Negotiations

Mitigation:

expiry
rate limiting
Risk: Owner Inactivity

Mitigation:

auto-expiry
notification system
Risk: Local Storage Scaling

Mitigation:

future S3 migration
Risk: COD Order Cancellation

Mitigation:

future: trust scoring system
17. Future Enhancements (Roadmap Thinking)
Seller analytics dashboard
Negotiation insights
Farmer trust score
Smart pricing rules (non-AI)
Multi-shop aggregation (later phase)
✅ Final Upgrade Summary

Your original PRD was:

Structurally correct ✅
Conceptually strong ✅

This version is now:

System-design ready
Interview-level strong (FAANG)
Engineering + Product aligned
Scalable & extensible

✨ 18. Frontend Experience & Interaction Design (NEW)
18.1 Design Philosophy

The frontend must reflect:

Clarity over complexity
Speed over decoration
State visibility over hidden logic

👉 Every UI state must mirror backend state machines.

18.2 Core UX Principles
1. State Transparency
Users must always know:
Negotiation status
Order status
Expiry timers

✔ Example:

ACTIVE → green indicator
EXPIRED → grey + disabled UI
2. Instant Feedback (Micro-interactions)

Every user action must trigger:

Visual response (<100ms)
Loading state
Success/failure feedback

✔ Example:

Button press → ripple/scale animation
Offer sent → message bubble animation
3. Motion as Communication (NOT decoration)

Animations must:

Explain transitions
Reduce confusion
Guide user attention
18.3 Screen-Level UI Requirements
🟢 Product Listing Page

Features:

Smooth card hover animations
Lazy loading images
Skeleton loaders while fetching

Animations:

Fade-in on load
Scale on hover (subtle)
Smooth pagination transitions
🟢 Product Detail Page

Features:

Price breakdown visibility
Negotiation CTA button

Animations:

Image zoom effect
Button pulse (CTA highlight)
Expand/collapse pricing details
🟢 Negotiation Chat (CRITICAL UI)

This is your core differentiator UI

Requirements:

Real-time message updates
Offer price highlights
Status indicator (ACTIVE / EXPIRED)

Animations:

Message bubble slide-in (left/right)
Price change highlight flash
Typing indicator (owner/farmer)

State Handling:

Disable input if:
EXPIRED
ACCEPTED
REJECTED
🟢 Order Dashboard

Features:

Timeline view of order states
Status badges

Animations:

Step progress animation
Status transition highlight
Expandable order details
18.4 Transition Design System
Page Transitions
Use fade + slide (200–300ms)
Avoid hard cuts
State Transitions
State Change	UI Behavior
INITIATED → ACTIVE	Highlight + glow
ACTIVE → ACCEPTED	Green success animation
ACTIVE → REJECTED	Red shake animation
ACTIVE → EXPIRED	Fade + disable UI
18.5 Loading & Skeleton States

Must include:

Skeleton cards (products)
Chat loading shimmer
Button loading spinners

👉 No blank screens allowed

18.6 Error Handling UX

Every failure must show:

Clear message
Retry option
Non-blocking UI

✔ Example:

“Socket disconnected → Reconnecting…”
18.7 Performance UX Targets
Interaction	Target
Button feedback	< 100ms
Page transition	< 300ms
Chat message render	< 200ms
Realtime update	< 1s
18.8 Animation Tech Stack

Frontend must use:

Framer Motion → animations
CSS Transitions → micro-interactions
React Skeleton Loaders
Socket.io client
18.9 Accessibility (Important)
Color-independent status indicators
Minimum touch target size
Readable typography
Low-motion mode support
18.10 Mobile-First Design

Since farmers are primary users:

Optimize for low-end devices
Reduce heavy animations
Ensure fast load on slow networks