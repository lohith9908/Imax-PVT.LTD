# IMAX Fertilizer Marketplace - Project Phases

Based strictly on the Product Requirements Document (PRD), the development of the multi-tenant, negotiation-first commerce platform is divided into the following structured phases. This ensures a logical path from system foundation to the strict state-machine controls required for the negotiation engine.

## Phase 1: Foundation & Architecture Setup
*Goal: Establish the core technical infrastructure, environments, and basic data models.*

**1.1 Environment Setup & Tooling**
- Initialize the environments for Frontend (React) and Backend (Express/Node.js).
- Configure Developer Experience (DX) commands (`npm run dev`, `npm run seed`) ensuring setup guarantees.
- Set up configurations (`.env`) ensuring no hardcoding (Ports, MongoDB URIs, JWT Secrets).

**1.2 Database & Data Modeling**
- Initialize MongoDB and establish horizontal scaling-ready indexing.
- Implement the core schemas: `User`, `Product`, `Inventory`, `Negotiation`, and `Order`.

**1.3 Auth Service & Security**
- Implement JWT-based authentication.
- Establish role-based authorization for the three core personas: **Farmer**, **Owner**, and **Admin**.

---

## Phase 2: Product & Base Inventory System
*Goal: Allow Owners and Admins to populate the system and Farmers to browse, with strict inventory rules.*

**2.1 Product Service**
- Implement basic CRUD operations for products (catalog management).
- Integrate File Uploads using **Multer** for local storage of product images.

**2.2 Inventory Handling**
- Implement system invariant: *Inventory must never go below zero*.
- Implement the baseline fetching of available stock for display. (Note: No stock reservation during negotiation).

**2.3 Direct Purchase Base**
- Implement the Direct Purchase Flow for Farmers where bulk pricing is applied and orders are placed instantly without negotiation.

---

## Phase 3: The Negotiation Engine (Core Domain)
*Goal: Build the stateful, realtime negotiation loop which is the primary differentiator of the product.*

**3.1 Negotiation State Machine**
- Implement strict transition rules: `INITIATED` → `ACTIVE` → `{ACCEPTED | REJECTED | EXPIRED}`.
- Block invalid transitions (e.g., Cannot accept expired negotiation, Cannot modify accepted negotiation).

**3.2 Real-time Communication**
- Integrate **Socket.io** for real-time messaging between Farmer and Owner.
- Ensure messages only flow when the state is `ACTIVE`.
- Implement polling fallbacks for edge-case socket failures.

**3.3 Expiry Flow & Guardrails**
- Build background worker to scan expired negotiations and update state to `EXPIRED`.
- Add rate limiting to negotiation creation to prevent spam and abuse.

---

## Phase 4: Order Lifecycle & Fulfillment
*Goal: Convert successful negotiations into strict transactional orders and manage completion.*

**4.1 Order State Machine**
- Implement order state transitions: `CREATED` → `PENDING` → `APPROVED` → `DISPATCHED` → `DELIVERED` (or `REJECTED`).

**4.2 Conflict Resolution & Payment State**
- Implement concurrency strategy (No locking, conflict resolved at order creation).
- Validate `stock > 0` upon final order creation and block the order if it fails.
- Implement Payment State Machine for COD logic: `PENDING` → `PAID` (COD confirmation). Ensure single shop per order limit.

---

## Phase 5: Administration & Observability
*Goal: Fulfill Admin persona requirements and finalize system stability.*

**5.1 Admin Oversight & Notifications**
- Build tools to monitor platform anomalies and enforce platform integrity.
- Implement the Notification Service to alert Owners of new negotiations and Farmers of updates.

**5.2 Performance & Quality Assurance**
- Ensure backend invariants strictly override any optimistic UI rendering.
- Verify non-functional targets: API latency `< 300ms`, Real-time updates `< 1s`.
- Confirm system failure modes are handled (e.g., duplicate requests stopped by idempotency keys, unhandled failures logged).

---

## Phase 6: Future Enhancements (Post-MVP)
*Goal: Implement the roadmap items designated for future phases.*

As designated in the PRD's 'Future Enhancements' and 'Risks & Mitigation' blocks:
- **Seller Analytics Dashboard** & **Negotiation Insights**.
- **Farmer Trust Score** (Mitigation for COD order cancellation risk).
- **Smart Pricing Rules** (Strictly non-AI).
- **Multi-shop Aggregation** (Later phase capability).
- Future migration from local storage (Multer) to **S3** for scaling resilience.
