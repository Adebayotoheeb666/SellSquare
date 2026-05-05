# SellSquare Internal Marketplace — Implementation Plan

**Last Updated**: April 2026  
**Status**: Ready for Implementation  
**Total Phases**: 11  
**Total Tasks**: 74

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Strategy](#architecture-strategy)
3. [Phase Breakdown](#phase-breakdown)
4. [Key Design Decisions](#key-design-decisions)
5. [Critical Implementation Notes](#critical-implementation-notes)
6. [Suggested Work Schedule](#suggested-work-schedule)
7. [Testing Checklist](#testing-checklist)
8. [Quick Reference](#quick-reference)

---

## Overview

This document outlines the complete implementation of the **SellSquare Internal Marketplace**, a buyer-facing storefront where end-customers discover and purchase from any KYC-approved SellSquare merchant, with:

- **KYC-gated business participation** — Businesses must submit and get admin approval before products appear
- **Escrow-backed payments** — Funds held until business accepts order
- **Per-business order flows** — One order created per business per buyer checkout
- **Buyer accounts & wallets** — Separate from business accounts; stores refunds and withdrawal funds
- **Real-time inventory synchronization** — 5-minute cart holds; WebSocket inventory updates
- **Store-specific links** — Each approved business gets a shareable link showing only their products

### What Already Exists (Do NOT Rebuild)

| Component | Location | Purpose |
|-----------|----------|---------|
| Partner API order flow (B2B) | `routes/publicMarketplaceRoute.js`, `controllers/publicMarketplace*.js` | Existing external integrations |
| Inventory hold model & service | `models/inventoryHoldModel.js`, `services/marketplace/inventoryHoldService.js` | 45-min holds for partner orders |
| WebSocket + SSE realtime | `events/WebSocketManager.js`, `events/SSEManager.js` | Real-time business event delivery |
| Business auth middleware | `middleWare/authMiddleware.js` | Existing JWT for business accounts |
| Marketplace Orders UI (business) | `client/src/pages/product/marketplace/Orders.js` | Existing partner order dashboard |
| Product `listProduct` flag | `models/productModel.js` | Determines if product appears in marketplace |
| `activeMarketplaceHoldQty` | `models/productModel.js` | Tracks inventory held by buyers |

---

## Architecture Strategy

### Approach: Backend-First, Phased Integration

1. **Phase 0-2**: Build complete data layer + auth systems (no external dependencies visible yet)
2. **Phase 3-5**: Add inventory & payment workflows (cart → checkout → escrow)
3. **Phase 6-7**: Order management & finances (business accept/reject → wallet updates)
4. **Phase 8-9**: Real-time notifications & buyer dashboard
5. **Phase 10-11**: Testing & launch

### Key Principles

| Principle | Implementation |
|-----------|----------------|
| **Multi-tenancy** | Every query filters by `req.business` or `req.buyer` |
| **Cache-first frontend** | Fetch once per session; paginate/filter client-side; Redux is source of truth |
| **Event-driven sync** | Cart holds → inventory events → WebSocket to business UI |
| **Minimal API chattiness** | Buyer checks out once; business processes one order per business per checkout |
| **Separate auth systems** | Business JWT (30d) ≠ Buyer JWT (30d); different secrets; different cookie names |
| **Idempotent operations** | Generate store token: calling twice returns same token; safe retries |

---

## Phase Breakdown

### ⚙️ Phase 0: Project Setup & Foundation

**Dependencies**: None  
**Estimated Tasks**: 4  
**Outcome**: Data layer complete; no API functionality yet

#### Phase 0.1: Create New MongoDB Models

Create these 6 new files in `models/`:

**`models/businessKycModel.js`**
- Business KYC submission tracking
- Fields: owner info (name, ID), business registration, address, bank account
- Status enum: draft → submitted → under_review → approved → rejected
- Unique `storeToken` (nullable until approved)
- Tracks submission count, rejection reason, approver info

**`models/buyerModel.js`**
- Separate buyer accounts (distinct from business accounts)
- Fields: firstName, lastName, email (unique), password (hashed), phone, defaultShippingAddress
- Pre-save hook: bcrypt password hashing
- Instance method: `matchPassword(plain)` for login

**`models/buyerWalletModel.js`**
- One wallet per buyer (created on registration)
- balance: number (default 0, min 0)
- transactions array: type (credit/debit), amount, reason, relatedOrder, createdAt
- currency: string (default "NGN")

**`models/businessWalletModel.js`**
- One wallet per business (created when KYC approved)
- Same structure as buyer wallet
- Stores escrow credits from accepted orders

**`models/internalMarketplaceOrderModel.js`**
- One order per business per buyer checkout session
- Fields:
  - `business`, `buyer`: ObjectIds
  - `checkoutSessionRef`: ties all orders from one cart together
  - `orderNumber`: unique IMO-{RANDOM} format
  - `status`: placed → payment_confirmed → accepted → rejected → processing → shipped → delivered
  - `lines`: array of { product, sku, quantity, price, holdId }
  - `subtotal`, `escrowEntryId`, `rejectionReason`
  - `statusHistory`: audit trail of status changes
- Pre-save: auto-generate orderNumber if missing

**`models/escrowEntryModel.js`**
- One per business per buyer checkout (parallel to internalMarketplaceOrder)
- Fields:
  - `buyer`, `business`, `order`: ObjectIds
  - `checkoutSessionRef`: shared with orders
  - `amount`, `currency`: escrow amount
  - `status`: held → released_to_business → refunded_to_buyer
  - `paymentReference`: external payment gateway reference
  - `paidAt`, `settledAt`: timestamps

#### Phase 0.2: Extend Inventory Hold Model

Edit `models/inventoryHoldModel.js` — add one new field to existing schema:

```javascript
source: {
  type: String,
  enum: ["partner_order", "buyer_cart"],
  default: "partner_order",
  index: true,
}
buyerSession: String,  // optional: session ID for unauthenticated holds
```

Edit `services/marketplace/constants.js` — add:
```javascript
exports.CART_HOLD_DURATION_MINUTES = 5;
exports.PARTNER_HOLD_DURATION_MINUTES = 45;
```

#### Phase 0.3: Add Environment Variables

Add to `.env` and `.env.example`:
```
BUYER_JWT_SECRET=<random-strong-secret-min-32-chars>
ADMIN_EMAILS=admin@example.com,admin2@example.com
CLIENT_URL=https://app.sellsquare.io
```

---

### 🔐 Phase 1: Buyer Authentication

**Dependencies**: Phase 0  
**Estimated Tasks**: 5  
**Outcome**: Buyers can register, login, logout; session persists

#### Phase 1.1: Backend Buyer Auth Middleware

Create `middleWare/buyerAuthMiddleware.js`:

- Extract token from `req.cookies.buyer_token` or `Authorization: Bearer <token>` header
- Verify with `BUYER_JWT_SECRET`
- Attach `req.buyer` with full Buyer document (excluding password)
- Return 401 if token missing/invalid

#### Phase 1.2: Backend Buyer Auth Controller

Create `controllers/buyerAuthController.js`:

**`registerBuyer(req, res)`**
- Validate: firstName, lastName, email (unique), password
- Hash password via buyerModel pre-save hook
- Create Buyer document
- Create BuyerWallet with balance: 0
- Sign JWT: `jwt.sign({ buyerId: buyer._id }, BUYER_JWT_SECRET, { expiresIn: "30d" })`
- Set `buyer_token` cookie (httpOnly, sameSite: "strict", maxAge: 30 days)
- Return buyer (exclude password) + statusCode 201

**`loginBuyer(req, res)`**
- Find Buyer by email; include password field (`+password`)
- Call `buyer.matchPassword(req.body.password)`
- If match: sign JWT, set cookie, return buyer
- If no match: return 401

**`logoutBuyer(req, res)`**
- Clear `buyer_token` cookie
- Return { message: "Logged out" }

**`getBuyerMe(req, res)`** [requires `protectBuyer`]
- Return `req.buyer`

#### Phase 1.3: Backend Buyer Auth Routes

Create `routes/buyerAuthRoute.js`:

```javascript
router.post("/register", registerBuyer);
router.post("/login", loginBuyer);
router.post("/logout", logoutBuyer);
router.get("/me", protectBuyer, getBuyerMe);
```

Mount in `server.js`:
```javascript
app.use("/api/buyer/auth", require("./routes/buyerAuthRoute"));
```

#### Phase 1.4: Frontend Buyer Auth Redux Slice

Create `client/src/redux/features/buyerAuth/buyerAuthSlice.js`:

- State: `{ buyer: null, isLoading: false, isAuthenticated: false }`
- Thunks:
  - `registerBuyer({ firstName, lastName, email, password })` → POST `/api/buyer/auth/register`
  - `loginBuyer({ email, password })` → POST `/api/buyer/auth/login`
  - `logoutBuyer()` → POST `/api/buyer/auth/logout`
  - `restoreBuyerSession()` → GET `/api/buyer/auth/me` (call on App mount)
- Reducers: set buyer, set loading, set authenticated
- Selectors: `selectBuyer`, `selectIsBuyerAuthenticated`, `selectBuyerLoading`

#### Phase 1.5: Frontend Buyer Auth UI Pages

Create `client/src/pages/web/Marketplace/BuyerLogin.jsx`:
- Email + password form
- "Don't have an account? Register" link
- On submit: dispatch `loginBuyer()` thunk
- On success: redirect to `/marketplace` or referrer
- Show loading spinner + error toast

Create `client/src/pages/web/Marketplace/BuyerRegister.jsx`:
- firstName, lastName, email, password, confirm password form
- Email validation (unique check can happen on blur)
- On submit: dispatch `registerBuyer()` thunk
- On success: auto-login, redirect to `/marketplace`
- Show loading spinner + error toast

Add routes in `client/src/App.js`:
```javascript
<Route path="/marketplace/login" element={<BuyerLogin />} />
<Route path="/marketplace/register" element={<BuyerRegister />} />
```

Add to App.js initialization:
```javascript
useEffect(() => {
  dispatch(restoreBuyerSession());  // Restore buyer session on load
}, [dispatch]);
```

---

### ✅ Phase 2: KYC & Business Approval

**Dependencies**: Phase 1  
**Estimated Tasks**: 8  
**Outcome**: Businesses can submit KYC; admins approve/reject; approved businesses get store tokens

#### Phase 2.1: Admin Middleware

Create `middleWare/adminMiddleware.js`:

```javascript
const adminMiddleware = (req, res, next) => {
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim());
  if (!req.business || !adminEmails.includes(req.business.businessEmail)) {
    res.status(403);
    throw new Error("Admin access required");
  }
  next();
};
```

Usage: Chain after `protect` middleware on admin routes.

#### Phase 2.2: KYC Controller

Create `controllers/kycController.js`:

**`submitKyc(req, res)`** [requires `protect`]
- Find or create `BusinessKyc` by `req.business._id`
- If status is `approved`: return 400 "Already approved"
- If status is `under_review`: return 400 "Currently under review"
- Parse `multipart/form-data`:
  - Text fields: ownerFullName, ownerNationalIdNumber, businessRegNumber, businessAddress (street, city, state), bankAccountName, bankAccountNumber, bankName
  - File uploads: ownerIdDocumentUrl, businessRegDocumentUrl (use `utils/fileUpload.js`)
- Update all fields; set `status = "submitted"`, `submittedAt = Date.now()`
- If resubmitting: increment `resubmissionCount`
- Save and return KYC document (exclude password, sensitive fields server-side redacted)

**`getKycStatus(req, res)`** [requires `protect`]
- Find `BusinessKyc` by `req.business._id`
- If not exists: return empty KYC with `status: null`
- Return current KYC with status + submission dates

**`listKyc(req, res)`** [requires `protect` + `adminMiddleware`]
- Query `BusinessKyc` with optional `?status=` filter
- Populate business (businessName, businessEmail)
- Use cursor pagination (`utils/cursorPagination.js`)
- Return paginated list

**`getKycForBusiness(req, res)`** [requires `protect` + `adminMiddleware`]
- Find by `businessId` param
- Populate business details
- Return full KYC (admin view includes file URLs)

**`approveKyc(req, res)`** [requires `protect` + `adminMiddleware`]
- Find by `businessId` param
- Set: `status = "approved"`, `approvedAt = Date.now()`, `reviewedAt = Date.now()`, `reviewedBy = req.business.businessEmail`
- Save
- TODO: Send email notification to business: "Your marketplace KYC has been approved"
- Return updated KYC

**`rejectKyc(req, res)`** [requires `protect` + `adminMiddleware`]
- Find by `businessId` param
- Set: `status = "rejected"`, `rejectionReason = req.body.reason`, `reviewedAt = Date.now()`, `reviewedBy = req.business.businessEmail`
- Save
- TODO: Send email notification with rejection reason
- Return updated KYC

#### Phase 2.3: Store Token Controller

Create `controllers/storeTokenController.js`:

**`generateStoreToken(req, res)`** [requires `protect`]
- Find `BusinessKyc` by `req.business._id`
- Verify `status === "approved"`; if not, return 400 "Business not approved for marketplace"
- If `storeToken` already exists: return existing token (idempotent)
- Generate: `require("crypto").randomBytes(16).toString("hex")`
- Set `storeToken` and `storeLinkGeneratedAt = Date.now()`
- Save
- Return: `{ storeToken, storeUrl: "${process.env.CLIENT_URL}/marketplace/store/${storeToken}" }`

#### Phase 2.4: KYC Routes

Create `routes/kycRoute.js`:

```javascript
router.post("/submit", protect, submitKyc);
router.get("/status", protect, getKycStatus);

// Admin routes
router.get("/admin/list", protect, adminMiddleware, listKyc);
router.get("/admin/:businessId", protect, adminMiddleware, getKycForBusiness);
router.post("/admin/:businessId/approve", protect, adminMiddleware, approveKyc);
router.post("/admin/:businessId/reject", protect, adminMiddleware, rejectKyc);

router.post("/generate-store-token", protect, generateStoreToken);
```

Mount in `server.js`:
```javascript
app.use("/api/kyc", require("./routes/kycRoute"));
```

#### Phase 2.5: Setup Tab UI — Business Dashboard

Create `client/src/pages/product/marketplace/Setup.js`:

**State A: Not Approved**

Render multi-step KYC form with fields:
- Owner: fullName, nationalIdNumber, idDocument (file upload)
- Business: regNumber, regDocument (file upload)
- Address: street, city, state
- Bank: accountName, accountNumber, bankName

On submit: `POST /api/kyc/submit` (multipart/form-data)

After submit, show status banner:
- `submitted`: "Documents submitted. Review in progress."
- `under_review`: "Documents under review. We'll notify you soon."
- `rejected`: Red banner with rejection reason; "Resubmit" button re-enables form with prefilled data
- `approved`: Green banner → proceed to State B

**State B: Approved**

Display:
- Green approval badge
- Store link section:
  ```
  Your marketplace store is approved.
  
  [Generate Store Link]  (spinner while loading)
  
  Store Link: https://app.sellsquare.io/marketplace/store/abc123def456
  [Copy Link]
  ```

"Generate Store Link" button: `POST /api/kyc/generate-store-token`
- On first click: generates token, displays link
- On second click: "Regenerate" button, returns same token (idempotent)
- Copy button: copies link to clipboard, shows toast confirmation

Create `client/src/services/kycService.js`:
```javascript
import axios from "../utils/axiosConfig";
const submitKyc = (formData) => axios.post("/api/kyc/submit", formData);
const getKycStatus = () => axios.get("/api/kyc/status");
const generateStoreToken = () => axios.post("/api/kyc/generate-store-token");
export default { submitKyc, getKycStatus, generateStoreToken };
```

#### Phase 2.6: Add Setup Tab to Sidebar

Edit `client/src/data/sidebar.js` — under Marketplace children array, add before Orders:
```javascript
{
  title: "Setup",
  path: "/marketplace/setup",
  icon: /* Gear/Settings SVG */,
}
```

#### Phase 2.7: Add Setup Route

Edit `client/src/App.js`:
```javascript
import MarketplaceSetup from "./pages/product/marketplace/Setup";
// inside authenticated route tree:
<Route path="/marketplace/setup" element={<MarketplaceSetup />} />
```

---

### 🛒 Phase 3: Cart Hold System (5-Minute Holds)

**Dependencies**: Phase 1 + Phase 2  
**Estimated Tasks**: 5  
**Outcome**: Buyers can add items to cart with 5-min inventory protection; real-time inventory sync

#### Phase 3.1: Buyer Marketplace Controller (Hold Operations)

Create `controllers/buyerMarketplaceController.js` with these methods:

**`createOrUpdateCartHold(req, res)`** [requires `protectBuyer`]
- Body: `{ productId, quantity }`
- Find Product by productId
- Verify product's business has approved KYC (check `BusinessKyc.status === "approved"`)
- Compute `availableQty = product.quantity - product.activeMarketplaceHoldQty`
- Validate: `quantity <= availableQty`; if not, return 400 "Insufficient stock"
- Check for existing active `buyer_cart` hold with matching productId + buyerId
  - If exists: release old hold, create new hold with updated quantity
  - If not: create new hold
- Call `inventoryHoldService.createLineHold()` with:
  - `source: "buyer_cart"`
  - `expiresAt: new Date(Date.now() + CART_HOLD_DURATION_MINUTES * 60 * 1000)`
- Emit WebSocket event: `eventBus.emitBusinessEvent("inventory.hold_updated", product.business.toString(), { productId, availableQty })`
- Return: `{ hold, availableQty }`

**`releaseCartHold(req, res)`** [requires `protectBuyer`]
- Param: productId
- Find active `buyer_cart` hold where `buyer === req.buyer._id` and `product === productId`
- Call `inventoryHoldService.releaseLineHold(hold._id)`
- Emit inventory event
- Return 200

**`getCartHolds(req, res)`** [requires `protectBuyer`]
- Query all active `buyer_cart` holds where `buyer === req.buyer._id`
- Populate product (name, image, price)
- For each: compute `availableQty` and time remaining until expiry
- Return array with holds + metadata

#### Phase 3.2: Update Inventory Hold Service

Edit `services/marketplace/inventoryHoldService.js`:

Ensure `createLineHold(productId, quantity, source, expiresAt, buyerId?)` supports:
- `source` parameter: "partner_order" or "buyer_cart"
- Custom `expiresAt` (instead of hardcoded)
- Optional `buyerId` for cart holds
- Update `product.activeMarketplaceHoldQty` atomically (increment on create, decrement on release)

Ensure `expireStaleHolds()` sweeper (runs every 15 mins) releases all holds where `expiresAt < Date.now()`.

#### Phase 3.3: Buyer Marketplace Routes (Cart Holds)

Create `routes/buyerMarketplaceRoute.js`:

```javascript
router.post("/cart/hold", protectBuyer, createOrUpdateCartHold);
router.delete("/cart/hold/:productId", protectBuyer, releaseCartHold);
router.get("/cart/holds", protectBuyer, getCartHolds);
```

Mount in `server.js`:
```javascript
app.use("/api/buyer/marketplace", require("./routes/buyerMarketplaceRoute"));
```

#### Phase 3.4: Real-time Inventory Events

After any hold operation in `buyerMarketplaceController.js`:
```javascript
const product = await Product.findById(productId).populate("business");
await eventBus.emitBusinessEvent(
  "inventory.hold_updated",
  product.business._id.toString(),
  {
    productId: product._id.toString(),
    holdType: "buyer_cart",
    availableQty: product.quantity - product.activeMarketplaceHoldQty,
  }
);
```

The existing `WebSocketManager.js` + `SSEManager.js` will deliver this to business clients.

#### Phase 3.5: Cart Hold Frontend Integration

Create `client/src/services/buyerMarketplaceService.js`:
```javascript
import axios from "../utils/axiosConfig";
const createOrUpdateHold = (data) => axios.post("/api/buyer/marketplace/cart/hold", data);
const releaseHold = (productId) => axios.delete(`/api/buyer/marketplace/cart/hold/${productId}`);
const getCartHolds = () => axios.get("/api/buyer/marketplace/cart/holds");
export default { createOrUpdateHold, releaseHold, getCartHolds };
```

Wire `client/src/pages/web/Marketplace/Cart.jsx`:
- On component mount: call `getCartHolds()`, populate cart state from API
- Add to cart: `createOrUpdateHold({ productId, quantity: 1 })`
- Update quantity: `createOrUpdateHold({ productId, quantity: newQty })`
- Remove item: `releaseHold(productId)`
- Display hold timer: "Reserved for X:XX" countdown based on `expiresAt`
- When timer expires: show "Reservation expired — re-check availability"

---

### 📦 Phase 4: Product Listings & Discovery

**Dependencies**: Phase 2 + Phase 3  
**Estimated Tasks**: 5  
**Outcome**: Buyers can browse KYC-approved products; store-filtered view works

#### Phase 4.1: Listings Controller Methods

Extend `controllers/buyerMarketplaceController.js`:

**`getListings(req, res)`** [no auth required]
- Query params: `search`, `category`, `minPrice`, `maxPrice`, `page`, `limit` (default 20), `storeToken`
- If `storeToken` provided:
  - Find `BusinessKyc` by token; verify `status === "approved"`
  - Filter products to that business only
- Else:
  - Find all `BusinessKyc` with `status === "approved"`, extract business IDs
  - Filter products to those business IDs
- Query `Product.find({ business: { $in: businessIds }, listProduct: true })`
  - Apply search: regex on name (case-insensitive)
  - Apply category filter if provided
  - Apply price range filter if provided
- For each product: compute `availableQty = quantity - activeMarketplaceHoldQty`; exclude if qty < 0
- Use `utils/cursorPagination.js` for pagination
- Response: `{ products, pagination, storeName? }`

**`getProductDetail(req, res)`** [no auth required]
- Find Product by productId
- Verify business has approved KYC
- Compute availableQty
- Return product + availableQty

**`getStoreInfo(req, res)`** [no auth required]
- Find `BusinessKyc` by `?storeToken=` query param
- Verify `status === "approved"`
- Populate business (businessName, address, logo)
- Return store metadata

#### Phase 4.2: Add Listings Routes

Add to `routes/buyerMarketplaceRoute.js`:
```javascript
router.get("/products", getListings);
router.get("/products/:productId", getProductDetail);
router.get("/store/:storeToken", getStoreInfo);
```

#### Phase 4.3: Wire Marketplace.jsx Frontend

Edit `client/src/pages/web/Marketplace/Marketplace.jsx`:

- On mount: call `getListings({ search: "", category: "", page: 1 })` via `buyerMarketplaceService`
- Extract `storeToken` from URL if present (e.g., `/marketplace/store/{storeToken}`)
- If storeToken provided: pass to all API calls, show store name banner at top
- Replace hardcoded product array with API results
- Render product cards with:
  - Image, name, price
  - `availableQty` display; if qty === 0, show "Out of Stock"
  - "Add to Cart" button → calls `createOrUpdateHold({ productId, quantity: 1 })`
  - On success: navigate to `/marketplace/cart` or update cart badge

#### Phase 4.4: Wire ProductDetail.jsx

Edit `client/src/pages/web/Marketplace/ProductDetail.jsx`:

- On mount: fetch `getProductDetail(productId)` via service
- Show: image, name, description, price, availableQty
- "Add to Cart" button: validate quantity input, call `createOrUpdateHold({ productId, quantity })`
- On success: show toast "Added to cart" + redirect to cart or stay on page

#### Phase 4.5: Store-Filtered View Route

Add to `client/src/App.js`:
```javascript
<Route path="/marketplace/store/:storeToken" element={<Marketplace />} />
```

In `Marketplace.jsx`: read `useParams().storeToken`; if present, pass to all API calls.

---

### 💳 Phase 5: Checkout & Escrow

**Dependencies**: Phase 3 + Phase 4  
**Estimated Tasks**: 5  
**Outcome**: Buyers can checkout; escrow entries created; funds held pending business decision

#### Phase 5.1: Checkout Controller Method

Extend `controllers/buyerMarketplaceController.js`:

**`checkout(req, res)`** [requires `protectBuyer`]
- Body: `{ paymentReference, shippingAddress }`
- Validate `paymentReference` by calling external payment gateway (e.g., Paystack API) to confirm amount + status
- Get all active cart holds for `req.buyer._id`
- Group holds by business
- Create `checkoutSessionRef = uuid()`
- For each business group:
  1. Compute subtotal across all lines
  2. Create `InternalMarketplaceOrder`:
     - `business`, `buyer`, `checkoutSessionRef`
     - `lines`: array of hold details + product info
     - `subtotal`
     - `status = "payment_confirmed"`
  3. Create `EscrowEntry`:
     - `buyer`, `business`, `order` (reference to created order)
     - `checkoutSessionRef`
     - `amount = subtotal`, `status = "held"`
     - `paymentReference`
     - `paidAt = Date.now()`
  4. Attach `escrowEntryId` to order; save order
  5. Mark all holds in this group as `consumed` via `inventoryHoldService.consumeOrderHolds()`
  6. Emit event: `eventBus.emitBusinessEvent("marketplace.internal_order.placed", business._id.toString(), { orderId, checkoutSessionRef, buyerName, ... })`
- Return: `{ orders: [...all created orders], checkoutSessionRef, totalAmount }`

#### Phase 5.2: Escrow State in Models

Ensure `EscrowEntry` model is indexed on `(buyer, business, status)` for fast queries during accept/reject.

#### Phase 5.3: Payment Verification

In checkout endpoint, add this verification before releasing escrow:
```javascript
// Example: Paystack verification
const response = await axios.get(
  `https://api.paystack.co/transaction/verify/${paymentReference}`,
  { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
);
if (response.data.data.status !== "success" || response.data.data.amount !== totalAmount * 100) {
  return res.status(400).json({ error: "Payment verification failed" });
}
```

#### Phase 5.4: Hold Consumption

Update `inventoryHoldService.js` to add:

**`consumeOrderHolds(holdIds)`**
- For each holdId: update status to `"consumed"`, `consumedAt = Date.now()`
- These holds will NOT be released by the 15-min sweeper (check: `status !== "expired"`)
- Used during checkout to mark holds as part of completed transaction

#### Phase 5.5: Checkout Routes

Add to `routes/buyerMarketplaceRoute.js`:
```javascript
router.post("/orders/checkout", protectBuyer, checkout);
```

---

### 📋 Phase 6: Internal Marketplace Orders (Business Accept/Reject)

**Dependencies**: Phase 5  
**Estimated Tasks**: 7  
**Outcome**: Businesses can accept/reject buyer orders; escrow released or refunded accordingly

#### Phase 6.1: Internal Order Controller

Create `controllers/internalMarketplaceOrderController.js`:

**`listInternalOrders(req, res)`** [requires `protect`]
- Query `InternalMarketplaceOrder.find({ business: req.business._id })`
- Optional filter by `?status=` query param
- Populate buyer (firstName, lastName, email)
- Use cursor pagination
- Return paginated list

**`getInternalOrder(req, res)`** [requires `protect`]
- Find by `orderId` and verify `business === req.business._id`
- Populate buyer, escrow entry
- Return full order detail

**`decideInternalOrder(req, res)`** [requires `protect`]
- Body: `{ decision: "accepted" | "rejected", reason?: string }`
- Find order by `orderId`, verify `business === req.business._id`
- Current status must be `"payment_confirmed"` (or throw 400)

**If accepted:**
1. Set `status = "accepted"`
2. Find `EscrowEntry` by `order` ID
3. Set escrow `status = "released_to_business"`, `settledAt = Date.now()`
4. Find or create `BusinessWallet` for this business
5. Increase wallet `balance` by `escrowEntry.amount`
6. Push transaction: `{ type: "credit", amount, reason: "Order accepted", relatedOrder }`
7. Set `buyer_notified_at = Date.now()`
8. Push status history entry: `{ from: "payment_confirmed", to: "accepted", by: req.business._id, at: Date.now() }`
9. Save order
10. Emit event: `eventBus.emitBusinessEvent("marketplace.internal_order.accepted", req.business._id.toString(), { orderId, buyerEmail, ... })`
11. TODO: Call buyer notification via WebSocket/SSE (see Phase 8)

**If rejected:**
1. Set `status = "rejected"`, `rejectionReason = reason`
2. Find `EscrowEntry` by `order` ID
3. Set escrow `status = "refunded_to_buyer"`, `settledAt = Date.now()`
4. Find or create `BuyerWallet` for this buyer
5. Increase wallet `balance` by `escrowEntry.amount`
6. Push transaction: `{ type: "credit", amount, reason: "Order rejected: " + reason, relatedOrder }`
7. Release any remaining holds via `inventoryHoldService.releaseOrderHolds(orderId)` (fallback)
8. Set `buyer_notified_at = Date.now()`
9. Push status history entry
10. Save order
11. Emit event: `eventBus.emitBusinessEvent("marketplace.internal_order.rejected", req.business._id.toString(), ...)`
12. TODO: Call buyer notification

Return updated order with status 200.

**`updateOrderStatus(req, res)`** [requires `protect`]
- Body: `{ newStatus: "processing" | "shipped" | "delivered" }`
- Find order, verify `business === req.business._id` and `status === "accepted"`
- Validate status progression: accepted → processing → shipped → delivered (only advance, no backwards)
- Set new status, push status history
- Save, emit event
- Return updated order

#### Phase 6.2: Internal Order Routes

Create routes in `routes/marketplaceRoute.js` (or add to existing if present):

```javascript
router.get("/internal-orders", protect, listInternalOrders);
router.get("/internal-orders/:orderId", protect, getInternalOrder);
router.post("/internal-orders/:orderId/decide", protect, decideInternalOrder);
router.post("/internal-orders/:orderId/status", protect, updateOrderStatus);
```

Mount in `server.js`:
```javascript
app.use("/api/marketplace", require("./routes/marketplaceRoute"));
```

#### Phase 6.3: Redux Slice for Internal Orders

Create `client/src/redux/features/dataCache/internalMarketplaceOrdersSlice.js` (or add to `bulkDataCacheSlice.js`):

Follow exact same pattern as existing `marketplaceOrders`:
- State: `{ byId: {}, allIds: [], meta: { cursor, hasMore }, loading }`
- Thunk: `fetchBulkInternalOrders({ force, status }) → GET /api/marketplace/internal-orders?status=...`
- Extract with `ensureArray(response)` before storing
- Selectors: `selectInternalOrdersArray()`, `selectInternalOrderMeta()`

#### Phase 6.4: Business Orders UI Tab

Edit `client/src/pages/product/marketplace/Orders.js`:

Add a tab switcher at top:
```
[Partner Orders]  [Buyer Orders]
```

When "Buyer Orders" tab active:
- Call `fetchBulkInternalOrders()` on tab click
- Show list of internal orders with: orderNumber, buyer name, status badge, amount, created date
- Click row → navigate to `/marketplace/buyer-orders/:orderId`

#### Phase 6.5: Internal Order Detail Page

Create `client/src/pages/product/marketplace/InternalOrderDetail.js`:

Display:
- Order header: orderNumber, buyer name + email, date, status
- Lines table: product name, quantity, unit price, line total
- Subtotal
- Current status + status history timeline
- Rejection reason (if status is rejected)

Action buttons (conditional on status):
- If status === "payment_confirmed":
  - "Accept Order" button → calls decide endpoint with "accepted" → shows success toast → refetch orders
  - "Reject Order" button → opens modal with reason textarea → calls decide with "rejected" + reason → refetch
- If status === "accepted":
  - "Mark Processing" button
  - "Mark Shipped" button
  - "Mark Delivered" button
  - (Each calls updateOrderStatus endpoint)

Use `useAsyncButton` hook for button loading states.

#### Phase 6.6: Add Route

Edit `client/src/App.js`:
```javascript
import InternalOrderDetail from "./pages/product/marketplace/InternalOrderDetail";
<Route path="/marketplace/buyer-orders/:orderId" element={<InternalOrderDetail />} />
```

Update sidebar (`client/src/data/sidebar.js`) if needed to surface this UI.

---

### 💰 Phase 7: Wallet Systems

**Dependencies**: Phase 6  
**Estimated Tasks**: 6  
**Outcome**: Business & buyer wallets track escrow releases and refunds; withdrawals work

#### Phase 7.1: Business Wallet Controller

Create `controllers/businessWalletController.js`:

**`getBalance(req, res)`** [requires `protect`]
- Find `BusinessWallet` by `req.business._id`
- If not exists: create with balance 0
- Return: `{ balance, currency }`

**`getTransactions(req, res)`** [requires `protect`]
- Find wallet, return `transactions` array with pagination (`limit=20` default)
- Each transaction: { type, amount, reason, reference, relatedOrder, createdAt }

**`requestWithdrawal(req, res)`** [requires `protect`]
- Body: `{ amount, bankName, accountNumber, accountName }`
- Find wallet
- Validate: `amount <= balance` and `amount > 0`
- Deduct from `balance`
- Push debit transaction: `{ type: "withdrawal", amount, reason: "Withdrawal request", reference: bankName }`
- TODO: Call Paystack Transfer API to initiate actual bank transfer (async, may fail)
- Return updated balance
- On Paystack failure: log error, notify business via email, offer retry

#### Phase 7.2: Buyer Wallet Controller

Create `controllers/buyerWalletController.js` with same 3 methods, scoped to `req.buyer` instead of `req.business`.

#### Phase 7.3: Wallet Routes

Create `routes/buyerWalletRoute.js`:
```javascript
router.get("/balance", protectBuyer, getBalance);
router.get("/transactions", protectBuyer, getTransactions);
router.post("/withdraw", protectBuyer, requestWithdrawal);
```

Add to existing marketplace routes for business:
```javascript
router.get("/wallet/balance", protect, getBalance);
router.get("/wallet/transactions", protect, getTransactions);
router.post("/wallet/withdraw", protect, requestWithdrawal);
```

Mount in `server.js`:
```javascript
app.use("/api/buyer/wallet", require("./routes/buyerWalletRoute"));
app.use("/api/marketplace/wallet", require("./routes/walletRoute")); // business wallet
```

#### Phase 7.4: Business Wallet Service (Frontend)

Create `client/src/services/businessWalletService.js`:
```javascript
import axios from "../utils/axiosConfig";
const getBalance = () => axios.get("/api/marketplace/wallet/balance");
const getTransactions = (params) => axios.get("/api/marketplace/wallet/transactions", { params });
const requestWithdrawal = (data) => axios.post("/api/marketplace/wallet/withdraw", data);
export default { getBalance, getTransactions, requestWithdrawal };
```

#### Phase 7.5: Wire Business Wallet Page

Edit `client/src/pages/product/marketplace/Wallet.js`:

- On mount: fetch balance + transactions
- Show:
  - Available balance (large card at top)
  - Transaction history table: date, type (credit/debit), amount, reason, order reference
- Withdrawal form:
  - Amount input
  - Bank name, account number, account name inputs
  - "Request Withdrawal" button (use `useAsyncButton`)
  - On success: show toast, refetch balance

#### Phase 7.6: Buyer Wallet Page

Create `client/src/pages/web/Marketplace/BuyerWallet.jsx`:

Same structure as business wallet but with `buyerWalletService.js` calls.

Create `client/src/services/buyerWalletService.js`:
```javascript
import axios from "../utils/axiosConfig";
const getBalance = () => axios.get("/api/buyer/wallet/balance");
const getTransactions = (params) => axios.get("/api/buyer/wallet/transactions", { params });
const requestWithdrawal = (data) => axios.post("/api/buyer/wallet/withdraw", data);
export default { getBalance, getTransactions, requestWithdrawal };
```

Add route in `client/src/App.js`:
```javascript
import BuyerWallet from "./pages/web/Marketplace/BuyerWallet";
<Route path="/marketplace/buyer/wallet" element={<BuyerWallet />} />
```

---

### 🔔 Phase 8: Real-time Notifications

**Dependencies**: Phase 6 + Phase 7  
**Estimated Tasks**: 5  
**Outcome**: Order status updates + wallet credits pushed to clients in real-time

#### Phase 8.1: Extend WebSocketManager for Buyer Channels

Edit `events/WebSocketManager.js`:

- During token verification (existing code), detect if token is buyer token:
  ```javascript
  // Try business JWT first, fall back to buyer JWT
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    decoded = jwt.verify(token, process.env.BUYER_JWT_SECRET);
    ws.buyerId = decoded.buyerId;
  }
  ```
- Add new Map: `buyerClients = new Map()` (keyed by buyerId)
- Register buyer in map: `buyerClients.set(buyerId, ws)`
- Add method:
  ```javascript
  notifyBuyer(buyerId, eventType, data) {
    const client = buyerClients.get(buyerId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: eventType, data }));
    }
  }
  ```

#### Phase 8.2: Extend SSEManager Similarly

Edit `events/SSEManager.js` (same pattern for SSE instead of WebSocket).

#### Phase 8.3: Emit Buyer Notifications

In `controllers/internalMarketplaceOrderController.js`, after accept/reject:

```javascript
// Use WebSocketManager or SSEManager
const { WebSocketManager } = require("../events/WebSocketManager");
const manager = WebSocketManager.getInstance();

if (accepted) {
  manager.notifyBuyer(buyer._id.toString(), "marketplace.internal_order.accepted", {
    orderId: order._id,
    businessName: business.businessName,
    amount: escrow.amount,
  });
} else {
  manager.notifyBuyer(buyer._id.toString(), "marketplace.internal_order.rejected", {
    orderId: order._id,
    businessName: business.businessName,
    amount: escrow.amount,
    reason: rejectionReason,
  });
}
```

Also emit when wallet is credited with refund.

#### Phase 8.4: Frontend Buyer Realtime Hook

Create `client/src/hooks/useBuyerRealtimeHook.js`:

```javascript
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useNotification } from "../hooks/useNotification";  // existing toast hook

export const useBuyerRealtime = () => {
  const dispatch = useDispatch();
  const showNotification = useNotification();

  useEffect(() => {
    const token = localStorage.getItem("buyer_token") || 
                  document.cookie.split("; ").find(c => c.startsWith("buyer_token="))?.split("=")[1];
    
    if (!token) return;

    const ws = new WebSocket(`wss://${window.location.host}/ws?token=${token}`);

    ws.onmessage = (msg) => {
      const event = JSON.parse(msg.data);
      
      if (event.type === "marketplace.internal_order.accepted") {
        showNotification({
          type: "success",
          message: `Order from ${event.data.businessName} accepted! ✓`,
        });
        dispatch(fetchBulkInternalOrdersForBuyer()); // Refresh
      }
      
      if (event.type === "marketplace.internal_order.rejected") {
        showNotification({
          type: "info",
          message: `Order rejected: ${event.data.reason}. Refund sent to wallet.`,
        });
        dispatch(fetchBulkInternalOrdersForBuyer());
        dispatch(fetchBuyerWalletBalance());
      }
      
      if (event.type === "wallet.credited") {
        showNotification({
          type: "info",
          message: `Wallet credited: ${event.data.currency} ${event.data.amount}`,
        });
        dispatch(fetchBuyerWalletBalance());
      }
    };

    return () => ws.close();
  }, [dispatch, showNotification]);
};
```

Use in buyer dashboard pages:
```javascript
export default function BuyerOrders() {
  useBuyerRealtime();  // Listens for updates
  // ... rest of component
}
```

#### Phase 8.5: Real-time Inventory on Public Marketplace

In `client/src/pages/web/Marketplace/Marketplace.jsx`, add polling:

```javascript
useEffect(() => {
  const interval = setInterval(() => {
    // Refetch current page of listings every 30 seconds if component is mounted
    dispatch(fetchBulkListings({ page: currentPage }));
  }, 30000);

  return () => clearInterval(interval);
}, [dispatch, currentPage]);
```

Alternatively, use a separate SSE connection for inventory updates (less bandwidth than refetch-all).

---

### 👤 Phase 9: Buyer Dashboard

**Dependencies**: Phase 6 + Phase 7 + Phase 8  
**Estimated Tasks**: 4  
**Outcome**: Buyers see their orders, order details, wallet; can withdraw funds

#### Phase 9.1: Buyer Orders List Page

Create `client/src/pages/web/Marketplace/BuyerOrders.jsx`:

- On mount: call `fetchBulkInternalOrdersForBuyer()` (new thunk in Redux)
- Group orders by `checkoutSessionRef` (one checkout session may have orders from multiple businesses)
- For each session group:
  - Show date, total amount, statuses of orders within
  - Expand/collapse to show individual orders
- Click order → navigate to detail page

#### Phase 9.2: Buyer Order Detail Page

Create `client/src/pages/web/Marketplace/BuyerOrderDetail.jsx`:

- Show:
  - Order number, business name, date
  - Status with status history timeline
  - Lines table: product, quantity, price, total
  - Subtotal
  - If rejected: rejection reason in red banner
- Actions:
  - If status pending/accepted: just view
  - No action buttons for buyer (business has control)

#### Phase 9.3: Buyer Protected Route

Create `client/src/components/BuyerProtectedRoute.jsx`:

```javascript
export default function BuyerProtectedRoute({ children }) {
  const isAuthenticated = useSelector(selectIsBuyerAuthenticated);
  
  if (!isAuthenticated) {
    return <Navigate to="/marketplace/login" />;
  }
  
  return children;
}
```

Use in App.js:
```javascript
<Route
  path="/marketplace/buyer/orders"
  element={
    <BuyerProtectedRoute>
      <BuyerOrders />
    </BuyerProtectedRoute>
  }
/>
```

#### Phase 9.4: Add Buyer Dashboard Routes

Edit `client/src/App.js`:
```javascript
import BuyerOrders from "./pages/web/Marketplace/BuyerOrders";
import BuyerOrderDetail from "./pages/web/Marketplace/BuyerOrderDetail";
import BuyerWallet from "./pages/web/Marketplace/BuyerWallet";

<Route
  path="/marketplace/buyer/orders"
  element={<BuyerProtectedRoute><BuyerOrders /></BuyerProtectedRoute>}
/>
<Route
  path="/marketplace/buyer/orders/:orderId"
  element={<BuyerProtectedRoute><BuyerOrderDetail /></BuyerProtectedRoute>}
/>
<Route
  path="/marketplace/buyer/wallet"
  element={<BuyerProtectedRoute><BuyerWallet /></BuyerProtectedRoute>}
/>
```

---

### ✔️ Phase 10: Comprehensive Testing

**Dependencies**: Phases 1-9  
**Estimated Tasks**: 9  
**Outcome**: All features tested; production-ready

#### Testing Checklist

**KYC Flow:**
- [ ] Business submits KYC → status becomes `submitted`
- [ ] Admin lists KYC submissions with status filter
- [ ] Admin approves → status becomes `approved`
- [ ] Admin rejects with reason → status becomes `rejected`; business sees reason on Setup page
- [ ] Business cannot generate store token until approved
- [ ] Approved business generates store token → unique token stored
- [ ] Second call to generate returns same token (idempotent)
- [ ] Unapproved business products do NOT appear in `GET /api/buyer/marketplace/products`

**Buyer Auth:**
- [ ] Register with new email → buyer created, wallet created, logged in, session persists
- [ ] Login with correct password → logged in
- [ ] Login with wrong password → 401
- [ ] Logout → session cleared
- [ ] Unauthenticated request to protected buyer route → 401 + redirect to login

**Listings & Store Link:**
- [ ] `GET /api/buyer/marketplace/products` returns only products from approved businesses with `listProduct: true`
- [ ] `GET /api/buyer/marketplace/store/:storeToken` returns only that business's products
- [ ] Out-of-stock products show "Out of Stock" on marketplace
- [ ] Store link URL works: `/marketplace/store/{token}` shows only that store

**Cart Holds (5-min):**
- [ ] `POST /cart/hold` creates hold, `product.activeMarketplaceHoldQty` increments
- [ ] `availableQty` decreases correctly
- [ ] Updating quantity: old hold released, new hold created, `activeMarketplaceHoldQty` updates atomically
- [ ] `DELETE /cart/hold/:productId` releases hold, `activeMarketplaceHoldQty` decrements
- [ ] After 5 mins (or via 15-min sweeper): hold expires, `activeMarketplaceHoldQty` decrements
- [ ] Inventory event fires on hold create/update/release
- [ ] Business sees live inventory updates

**Checkout & Escrow:**
- [ ] Single business checkout: 1 order created, 1 escrow entry created
- [ ] Multi-business checkout (3 items from Business A, 2 from Business B):
  - 2 orders created (one per business)
  - 2 escrow entries created
  - All share same `checkoutSessionRef`
  - `availableQty` updated for all products
  - Cart holds marked `consumed`
- [ ] Order status = `payment_confirmed` post-checkout
- [ ] Escrow status = `held` post-checkout
- [ ] Invalid payment reference → checkout fails
- [ ] Business receives `marketplace.internal_order.placed` event

**Order Decision — Accept:**
- [ ] Business calls `POST /internal-orders/:orderId/decide` with `accepted`
- [ ] Order status → `accepted`
- [ ] Escrow status → `released_to_business`
- [ ] `BusinessWallet.balance` increases by order subtotal
- [ ] `BusinessWallet.transactions` has credit entry
- [ ] Buyer receives `marketplace.internal_order.accepted` notification
- [ ] Buyer sees updated order status in dashboard
- [ ] Buyer can advance status: processing → shipped → delivered

**Order Decision — Reject:**
- [ ] Business calls decide with `rejected` + reason
- [ ] Order status → `rejected`
- [ ] Escrow status → `refunded_to_buyer`
- [ ] `BuyerWallet.balance` increases by order subtotal
- [ ] `BuyerWallet.transactions` has credit entry with reason
- [ ] Buyer receives `marketplace.internal_order.rejected` notification with reason
- [ ] Buyer sees rejection reason on order detail page
- [ ] Buyer wallet balance reflects refund

**Multi-Business Checkout:**
- [ ] Cart: Business A (2 items) + Business B (1 item)
- [ ] Checkout → 2 orders created
- [ ] Business A accepts → A's wallet credited
- [ ] Business B rejects with reason → B's funds returned to buyer wallet
- [ ] Buyer sees both order statuses in dashboard
- [ ] Buyer wallet shows both credit entries (one credit, one refund)

**Business Wallet:**
- [ ] `GET /marketplace/wallet/balance` returns correct balance
- [ ] `POST /marketplace/wallet/withdraw` deducts from balance (if balance >= amount)
- [ ] Withdrawal with amount > balance → 400 "Insufficient funds"
- [ ] Withdrawal → transaction logged with type: "withdrawal"
- [ ] Bank transfer API called (success or fail logged)

**Buyer Wallet:**
- [ ] Same as business wallet
- [ ] Withdrawal → funds deducted, transaction logged

**Real-time:**
- [ ] Business WebSocket connected → receives `inventory.hold_updated` events
- [ ] Buyer WebSocket connected → receives `marketplace.internal_order.accepted/rejected` events
- [ ] Order status advances: all notifications pushed correctly
- [ ] Multiple buyers on same product: all receive inventory updates

---

### 🚀 Phase 11: Launch & Deployment

**Dependencies**: Phase 10  
**Estimated Tasks**: 1  
**Outcome**: Code merged to main branch; deployed to production

#### Final Checklist

- [ ] All tests pass: `npm test` (backend), `npm run test:ci` (frontend)
- [ ] No TypeScript errors (if using TS)
- [ ] No console warnings
- [ ] Code review completed
- [ ] All env vars documented in `.env.example`
- [ ] Git commit message references task/PR
- [ ] Push to remote + create PR
- [ ] Merge to main after approval
- [ ] Deploy to staging first (manual testing)
- [ ] Deploy to production
- [ ] Monitor logs for errors (first 24 hours)
- [ ] Notify stakeholders

---

## Key Design Decisions

| Decision | Rationale | Alternative Considered |
|----------|-----------|------------------------|
| **Separate buyer accounts** | Multi-tenant; buyers are not businesses | Use business accounts for both (rejected: violates tenant isolation) |
| **5-min cart holds** | Balance between inventory protection & UX (enough for checkout, not too long) | 10 min (too long), 2 min (too short) |
| **Escrow vs instant** | Trust & dispute resolution; funds released only on acceptance | Direct payment (rejected: no protection for buyer) |
| **One order per business** | Clear ownership & simpler dispute handling | One order for entire checkout (rejected: complicated who decides what) |
| **WebSocket events** | Real-time sync; scale better | Polling (rejected: wasteful), Server-Sent Events (acceptable alt) |
| **Admin KYC approval** | Compliance & vetting | Auto-approve (rejected: no protection) |
| **Store token UUID** | Shareable, unguessable, secure | Business slug (rejected: expose business name) |
| **Redux cache-first** | Reduce API calls; offline support | Fetch on every page load (rejected: slow, wasteful) |
| **Cursor pagination** | Scalable, handles deletes | Offset pagination (rejected: not cursor-based per CLAUDE.md) |

---

## Critical Implementation Notes ⚠️

### Multi-Tenancy
- **Business endpoints** (`/api/marketplace/*`, `/api/kyc/*`): Always filter by `req.business._id`
- **Buyer endpoints** (`/api/buyer/marketplace/*`): Always filter by `req.buyer._id`
- **Admin endpoints** (`/api/admin/*`): Check `adminMiddleware` after `protect`

### Redux Cache-First
- Fetch marketplace listings **once per session** during app init
- Paginate / filter **client-side** from Redux
- Do NOT fetch again on route changes or page navigation
- Refetch only on explicit user action: "Refresh", "View Details", or mutation success

### `ensureArray()` Pattern
```javascript
// In reducers, ALWAYS extract arrays before storing
const products = ensureArray(payload.products);
state.productsByBusiness[businessId] = products;
```

### Cursor Pagination
- Use `utils/cursorPagination.js` on all list endpoints
- Backend returns `{ items: [...], cursor, hasMore }`
- Frontend: store cursor, next click passes cursor to API

### File Uploads
- Use existing `utils/fileUpload.js` for KYC document uploads
- Returns file path string; store in model

### Event Middleware
- All mutations emit events: `eventBus.emitBusinessEvent(type, businessId, data)`
- Business receives events over WebSocket/SSE
- Do NOT skip events for "sync reasons" — events are primary sync mechanism

### No Offset Pagination
- Codebase uses cursor-based pagination throughout
- Do NOT introduce offset/page pagination for new endpoints

---

## Suggested Work Schedule

### Week 1: Foundation + Buyer Auth
1. **Phase 0** (Day 1-2): Models + env
2. **Phase 1** (Day 2-3): Buyer auth (backend + frontend)
3. Test buyer registration/login/logout

### Week 2: KYC + Product Discovery
4. **Phase 2** (Day 4-5): KYC submission + admin approval + Setup UI
5. **Phase 4** (Day 5-6): Product listings + store-filtered view
6. Test KYC approval flow; list products

### Week 3: Cart & Checkout
7. **Phase 3** (Day 7-8): Cart holds (5-min expiry)
8. **Phase 5** (Day 8-9): Checkout + escrow
9. Test adding to cart; checkout; escrow creation

### Week 4: Orders + Wallets
10. **Phase 6** (Day 10-11): Order accept/reject
11. **Phase 7** (Day 11-12): Wallets (business + buyer)
12. Test full order lifecycle; wallet balance updates

### Week 5: Real-time + Dashboard
13. **Phase 8** (Day 13): Real-time notifications
14. **Phase 9** (Day 14): Buyer dashboard
15. Test WebSocket order updates; buyer dashboard

### Week 6: Testing & Launch
16. **Phase 10** (Day 15-16): Full testing suite
17. **Phase 11** (Day 17): Code review + merge + deploy

**Note**: Timelines are estimates; depends on engineer familiarity with codebase.

---

## Parallel Work Opportunities

While waiting for code reviews or API availability:
- Phase 2 (KYC Setup UI) can start while Phase 1 tests are finishing
- Phase 4 (Listings UI) can start while Phase 3 backend is being coded
- Phase 7 (Wallet UI) can start while Phase 6 order logic finalizes
- Phase 8 (Real-time) can be integrated alongside Phase 6/7

---

## Testing Strategy

### Unit Tests (Backend)
- KYC model validation
- Inventory hold logic (create, expire, consume)
- Wallet credit/debit logic
- Order status transitions (state machine validation)

### Integration Tests (Backend)
- KYC submission → approval workflow
- Buyer auth flow (register → login → session restore)
- Product listing with filters
- Cart hold creation + release
- Checkout → order + escrow creation
- Order accept/reject → wallet updates
- Real-time event emission

### Frontend Component Tests
- Buyer login/register forms
- KYC form with file upload
- Cart with hold timers
- Marketplace listings with filters
- Order detail page status rendering
- Wallet balance display

### End-to-End Tests (if using Cypress/Playwright)
- Full buyer journey: register → browse → add to cart → checkout → receive notification → withdraw funds
- Full business journey: submit KYC → approval → see products → accept order → receive funds

---

## Quick Reference: File Structure After Implementation

```
backend/
├── models/
│   ├── businessKycModel.js        [NEW]
│   ├── buyerModel.js               [NEW]
│   ├── buyerWalletModel.js         [NEW]
│   ├── businessWalletModel.js      [NEW]
│   ├── internalMarketplaceOrderModel.js [NEW]
│   ├── escrowEntryModel.js         [NEW]
│   ├── inventoryHoldModel.js       [EXTENDED]
│   └── ...existing
├── controllers/
│   ├── kycController.js            [NEW]
│   ├── storeTokenController.js     [NEW]
│   ├── buyerAuthController.js      [NEW]
│   ├── buyerMarketplaceController.js [NEW]
│   ├── internalMarketplaceOrderController.js [NEW]
│   ├── businessWalletController.js [NEW]
│   ├── buyerWalletController.js    [NEW]
│   └── ...existing
├── routes/
│   ├── kycRoute.js                 [NEW]
│   ├── buyerAuthRoute.js           [NEW]
│   ├── buyerMarketplaceRoute.js    [NEW]
│   ├── buyerWalletRoute.js         [NEW]
│   ├── marketplaceRoute.js         [NEW for internal orders]
│   └── ...existing
├── middleWare/
│   ├── buyerAuthMiddleware.js      [NEW]
│   ├── adminMiddleware.js          [NEW]
│   └── ...existing
├── services/
│   ├── marketplace/
│   │   ├── inventoryHoldService.js [EXTENDED]
│   │   └── constants.js            [EXTENDED]
│   └── ...existing
└── ...existing

client/
├── pages/
│   ├── product/marketplace/
│   │   ├── Setup.js                [NEW]
│   │   ├── Wallet.js               [EXTENDED]
│   │   ├── Orders.js               [EXTENDED]
│   │   ├── InternalOrderDetail.js  [NEW]
│   │   └── ...existing
│   ├── web/Marketplace/
│   │   ├── BuyerLogin.jsx          [NEW]
│   │   ├── BuyerRegister.jsx       [NEW]
│   │   ├── Marketplace.jsx         [EXTENDED]
│   │   ├── ProductDetail.jsx       [EXTENDED]
│   │   ├── Cart.jsx                [EXTENDED]
│   │   ├── BuyerOrders.jsx         [NEW]
│   │   ├── BuyerOrderDetail.jsx    [NEW]
│   │   ├── BuyerWallet.jsx         [NEW]
│   │   └── ...existing
├── redux/
│   ├── features/
│   │   ├── buyerAuth/
│   │   │   └── buyerAuthSlice.js   [NEW]
│   │   ├── dataCache/
│   │   │   ├── bulkDataCacheSlice.js [EXTENDED - add internalMarketplaceOrders]
│   │   │   └── ...existing
│   │   └── ...existing
├── services/
│   ├── kycService.js               [NEW]
│   ├── buyerAuthService.js         [NEW]
│   ├── buyerMarketplaceService.js  [NEW]
│   ├── businessWalletService.js    [NEW]
│   ├── buyerWalletService.js       [NEW]
│   └── ...existing
├── hooks/
│   └── useBuyerRealtimeHook.js     [NEW]
├── components/
│   └── BuyerProtectedRoute.jsx     [NEW]
├── data/
│   └── sidebar.js                  [EXTENDED - add Setup tab]
└── ...existing
```

---

## Environment Variables Checklist

Add to `.env` and `.env.example`:
```
# Buyer authentication
BUYER_JWT_SECRET=<random-strong-secret-32+ chars>

# Admin access control
ADMIN_EMAILS=admin1@example.com,admin2@example.com

# Frontend URLs (used for store link generation)
CLIENT_URL=https://app.sellsquare.io

# Paystack (or your payment provider)
PAYSTACK_SECRET_KEY=<existing or new>
```

---

## Next Steps After Reading This Plan

1. **Share with team** — Ensure alignment on architecture + phases
2. **Start Phase 0** — Create models + extend inventoryHoldModel
3. **Open GitHub issues** — One per phase for tracking
4. **Setup feature branch** — `git checkout -b marketplace-implementation`
5. **Begin Phase 1** — Buyer auth (lowest risk, enables testing of later phases)

---

## Appendix: Quick Command Reference

```bash
# Backend
npm run dev                    # Start dev server
npm test                       # Run tests
npm run test:watch           # Watch mode

# Frontend
cd client && npm start        # Dev server
cd client && npm test         # Run tests
cd client && npm run test:ci  # CI tests

# Git
git checkout -b marketplace   # Create branch
git add .                     # Stage changes
git commit -m "feat: ..."     # Commit
git push origin marketplace   # Push for PR
```

---

**Document Version**: 1.0  
**Last Updated**: April 2026  
**Status**: Ready for Implementation  
**Approved By**: [Your Name/Team]
