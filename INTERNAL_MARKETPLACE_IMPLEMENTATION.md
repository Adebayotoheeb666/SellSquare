# SellSquare Internal Marketplace — Developer Implementation Instructions

## Overview

This document describes everything required to ship the SellSquare internal marketplace: a buyer-facing storefront where end-customers can discover and purchase from any SellSquare merchant, with KYC-gated business participation, escrow-backed payments, per-business order flows, buyer wallets, and real-time inventory synchronisation.

**Read before starting:**
- `docs/PUBLIC_MARKETPLACE_INTEGRATION.md` — the existing partner API (B2B). Do NOT touch its auth chain or routes. This feature runs alongside it.
- `CLAUDE.md` — architecture rules, especially the Redux cache-first and multi-tenancy requirements.
- `client/REDUX_DATA_ARCHITECTURE.md` — ensureArray spec and forbidden patterns.

---

## What Already Exists (do not rebuild)

| What | Where |
|---|---|
| Partner API order flow (B2B) | `routes/publicMarketplaceRoute.js`, `controllers/publicMarketplace*.js` |
| Inventory hold model & service | `models/inventoryHoldModel.js`, `services/marketplace/inventoryHoldService.js` |
| 45-min hold expiry sweeper | `jobs/marketplaceHoldExpiryJob.js` |
| WebSocket + SSE realtime | `events/WebSocketManager.js`, `events/SSEManager.js` |
| Business auth middleware | `middleWare/authMiddleware.js` |
| Marketplace Orders UI (business side) | `client/src/pages/product/marketplace/Orders.js`, `OrderDetail.js` |
| Public marketplace UI shell (mocked) | `client/src/pages/web/Marketplace/Marketplace.jsx`, `Cart.jsx`, `ProductDetail.jsx` |
| Product `listProduct` flag | `models/productModel.js` field `listProduct: Boolean` |
| `activeMarketplaceHoldQty` on Product | `models/productModel.js` |
| Redux `marketplaceOrders` cache + selectors | `client/src/redux/features/dataCache/bulkDataCacheSlice.js` |
| Marketplace sidebar nav (Orders, Discounts, Wallet) | `client/src/data/sidebar.js` |

---

## Scope of This Implementation

1. **KYC / Marketplace Setup** — Business submits KYC; admin approves; products become visible.
2. **Store Link** — Approved business generates a unique shareable URL.
3. **Buyer Auth** — Separate buyer accounts (not business accounts).
4. **Public Marketplace (buyer-facing)** — Browse, search, and buy products from all approved businesses; store-filtered view via store link.
5. **Cart Holds** — 5-minute inventory reservation when a buyer adds to cart (distinct from the existing 45-min partner hold).
6. **Checkout & Escrow** — Buyer pays; funds go into escrow split by business.
7. **Internal Marketplace Orders** — One order per business per buyer checkout; business accepts/rejects on their existing Orders tab.
8. **Buyer Dashboard** — Order status, wallet balance, withdrawal to bank.
9. **Business Wallet** — Receives released escrow funds per accepted order; visible under Marketplace > Wallet.

---

## Part 1 — Backend

### 1.1 New Models

#### `models/businessKycModel.js`

```javascript
const mongoose = require("mongoose");
const { Schema } = mongoose;

const businessKycSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "BusinessRegistration", required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["draft", "submitted", "under_review", "approved", "rejected"],
      default: "draft",
      index: true,
    },
    submittedAt: Date,
    reviewedAt: Date,
    reviewedBy: String,
    rejectionReason: String,
    resubmissionCount: { type: Number, default: 0 },

    // KYC form fields
    ownerFullName: { type: String, trim: true },
    ownerNationalIdNumber: { type: String, trim: true },
    ownerIdDocumentUrl: String,       // uploaded file path
    businessRegNumber: { type: String, trim: true },
    businessRegDocumentUrl: String,   // uploaded file path
    businessAddress: {
      street: String,
      city: String,
      state: String,
      country: { type: String, default: "Nigeria" },
    },
    bankAccountName: { type: String, trim: true },
    bankAccountNumber: { type: String, trim: true },
    bankName: { type: String, trim: true },

    // Set by system on approval
    storeToken: { type: String, unique: true, sparse: true, index: true },
    storeLinkGeneratedAt: Date,
    approvedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("BusinessKyc", businessKycSchema);
```

#### `models/buyerModel.js`

```javascript
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { Schema } = mongoose;

const buyerSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    password: { type: String, required: true, select: false },
    isEmailVerified: { type: Boolean, default: false },
    defaultShippingAddress: {
      street: String,
      city: String,
      state: String,
      country: { type: String, default: "Nigeria" },
    },
  },
  { timestamps: true }
);

buyerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

buyerSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model("Buyer", buyerSchema);
```

#### `models/buyerWalletModel.js`

```javascript
const mongoose = require("mongoose");
const { Schema } = mongoose;

const transactionSchema = new Schema({
  type: { type: String, enum: ["credit", "debit"], required: true },
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  reference: String,
  relatedOrder: { type: Schema.Types.ObjectId, ref: "InternalMarketplaceOrder" },
  createdAt: { type: Date, default: Date.now },
});

const buyerWalletSchema = new Schema(
  {
    buyer: { type: Schema.Types.ObjectId, ref: "Buyer", required: true, unique: true, index: true },
    balance: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "NGN" },
    transactions: [transactionSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("BuyerWallet", buyerWalletSchema);
```

#### `models/businessWalletModel.js`

```javascript
const mongoose = require("mongoose");
const { Schema } = mongoose;

const businessTransactionSchema = new Schema({
  type: { type: String, enum: ["credit", "debit", "withdrawal"], required: true },
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  reference: String,
  relatedOrder: { type: Schema.Types.ObjectId, ref: "InternalMarketplaceOrder" },
  createdAt: { type: Date, default: Date.now },
});

const businessWalletSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "BusinessRegistration", required: true, unique: true, index: true },
    balance: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "NGN" },
    transactions: [businessTransactionSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("BusinessWallet", businessWalletSchema);
```

#### `models/internalMarketplaceOrderModel.js`

One order per business per buyer checkout session. Multiple such orders can share a `checkoutSessionRef`.

```javascript
const mongoose = require("mongoose");
const { Schema } = mongoose;

const lineSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  productGroup: { type: Schema.Types.ObjectId, ref: "ProductGroup" },
  isGroupVariant: { type: Boolean, default: false },
  sku: String,
  name: String,
  variantLabel: String,
  image: String,
  requestedQty: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  lineTotal: { type: Number, required: true },
  holdId: { type: Schema.Types.ObjectId, ref: "InventoryHold" },
});

const internalMarketplaceOrderSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "BusinessRegistration", required: true, index: true },
    buyer: { type: Schema.Types.ObjectId, ref: "Buyer", required: true, index: true },
    checkoutSessionRef: { type: String, index: true },   // ties together all orders from one cart checkout
    orderNumber: { type: String, unique: true },         // IMO-{businessSlug}-{random}

    status: {
      type: String,
      enum: ["placed", "payment_confirmed", "accepted", "rejected", "processing", "shipped", "delivered"],
      default: "placed",
      index: true,
    },

    lines: [lineSchema],

    subtotal: { type: Number, required: true },

    escrowEntryId: { type: Schema.Types.ObjectId, ref: "EscrowEntry", index: true },

    rejectionReason: String,

    buyer_notified_at: Date,

    statusHistory: [
      {
        from: String,
        to: String,
        by: String,
        reason: String,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Auto-generate orderNumber before save
internalMarketplaceOrderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.orderNumber = `IMO-${rand}`;
  }
  next();
});

module.exports = mongoose.model("InternalMarketplaceOrder", internalMarketplaceOrderSchema);
```

#### `models/escrowEntryModel.js`

One escrow entry per business per buyer checkout (parallel to `internalMarketplaceOrderModel`).

```javascript
const mongoose = require("mongoose");
const { Schema } = mongoose;

const escrowEntrySchema = new Schema(
  {
    buyer: { type: Schema.Types.ObjectId, ref: "Buyer", required: true, index: true },
    business: { type: Schema.Types.ObjectId, ref: "BusinessRegistration", required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: "InternalMarketplaceOrder", required: true, unique: true },
    checkoutSessionRef: { type: String, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "NGN" },
    status: {
      type: String,
      enum: ["held", "released_to_business", "refunded_to_buyer"],
      default: "held",
      index: true,
    },
    paymentReference: String,
    paidAt: Date,
    settledAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("EscrowEntry", escrowEntrySchema);
```

---

### 1.2 Extend `models/inventoryHoldModel.js`

Add a `source` field and a shorter `CART_HOLD_DURATION_MINUTES` constant. The existing schema definition in `inventoryHoldModel.js` needs one new field:

```javascript
// Add to the hold schema alongside existing fields:
source: {
  type: String,
  enum: ["partner_order", "buyer_cart"],
  default: "partner_order",
  index: true,
},
buyerSession: String,  // ephemeral session ID for unauthenticated cart holds (optional)
```

In `services/marketplace/constants.js` add:
```javascript
exports.CART_HOLD_DURATION_MINUTES = 5;
```

The existing `expireStaleHolds()` in `inventoryHoldService.js` already queries by `expiresAt < now`, so cart holds will be swept automatically every 15 minutes. No changes needed there.

---

### 1.3 New Backend Routes

#### KYC Routes — `routes/kycRoute.js`

Mount at `/api/kyc` in `server.js` (authenticated, scoped to `req.business`).

```
POST   /api/kyc/submit          Submit or resubmit KYC (multipart/form-data for file uploads)
GET    /api/kyc/status          Get own KYC status and fields
```

Admin routes — add to a new `routes/adminRoute.js` (or existing admin route if one exists) protected with a separate admin-only middleware:

```
GET    /api/admin/kyc                    List all KYC submissions (with status filter)
GET    /api/admin/kyc/:businessId        Get full KYC for a business
POST   /api/admin/kyc/:businessId/approve
POST   /api/admin/kyc/:businessId/reject   body: { reason }
```

#### Buyer Auth Routes — `routes/buyerAuthRoute.js`

Mount at `/api/buyer/auth` (no auth required for register/login).

```
POST   /api/buyer/auth/register
POST   /api/buyer/auth/login
POST   /api/buyer/auth/logout
GET    /api/buyer/auth/me              (requires buyerAuth)
```

#### Buyer Marketplace Routes — `routes/buyerMarketplaceRoute.js`

Mount at `/api/buyer/marketplace`. All endpoints except `/products` require buyer auth middleware.

```
GET    /products                    Browse all approved listings (no auth required)
GET    /products/:productId         Product detail (no auth required)
GET    /store/:storeToken           Get store info + products for a store link
POST   /cart/hold                   Create or update a cart hold (buyer auth)
DELETE /cart/hold/:productId        Release a cart hold (buyer auth)
GET    /cart/holds                  List active holds for current buyer session
POST   /orders/checkout             Place orders (one per business) from cart (buyer auth)
GET    /orders                      Buyer's order list (buyer auth)
GET    /orders/:orderId             Buyer's order detail (buyer auth)
```

#### Buyer Wallet Routes — `routes/buyerWalletRoute.js`

Mount at `/api/buyer/wallet`. All require buyer auth.

```
GET    /api/buyer/wallet/balance
GET    /api/buyer/wallet/transactions
POST   /api/buyer/wallet/withdraw     body: { amount, bankName, accountNumber, accountName }
```

#### Business Wallet Updates — extend existing `/api/marketplace/wallet`

The existing `Wallet.js` page and route stub need to be wired to:
```
GET    /api/marketplace/wallet/balance
GET    /api/marketplace/wallet/transactions
POST   /api/marketplace/wallet/withdraw
```

Mount at `/api/marketplace` protected by existing `protect` middleware (business auth). Create `controllers/businessWalletController.js`.

---

### 1.4 New Controllers

#### `controllers/kycController.js`

**`submitKyc(req, res)`**
- Find or create `BusinessKyc` by `req.business._id`.
- If status is `approved`, return 400 ("Already approved").
- If status is `under_review`, return 400 ("Currently under review").
- Accept `multipart/form-data`. Use the existing `utils/fileUpload.js` helper for `ownerIdDocumentUrl` and `businessRegDocumentUrl`.
- Update all KYC text fields from `req.body`.
- Set `status = "submitted"`, increment `resubmissionCount` if > 0, set `submittedAt = Date.now()`.
- Save and return the KYC document.

**`getKycStatus(req, res)`**
- Find `BusinessKyc` for `req.business._id`. Return null fields if none exists (first visit).

**`listKyc(req, res)`** (admin)
- Query `BusinessKyc` with optional `status` filter. Populate `business` (name + email). Paginate with cursor (`utils/cursorPagination.js`).

**`getKycForBusiness(req, res)`** (admin)
- Find by `businessId` param. Populate business.

**`approveKyc(req, res)`** (admin)
- Set `status = "approved"`, `reviewedAt`, `reviewedBy = req.adminUser.email`, `approvedAt`.
- Do NOT generate the store token here — the business generates it themselves.
- Save.
- TODO: send notification email to business.

**`rejectKyc(req, res)`** (admin)
- Set `status = "rejected"`, `reviewedAt`, `reviewedBy`, `rejectionReason = req.body.reason`.
- Save.
- TODO: send notification email to business.

---

#### `controllers/storeTokenController.js`

**`generateStoreToken(req, res)`**
- Find `BusinessKyc` for `req.business._id`. Verify `status === "approved"`.
- If `storeToken` already exists, return existing token (idempotent).
- Generate: `require("crypto").randomBytes(16).toString("hex")`.
- Set `storeToken` and `storeLinkGeneratedAt = Date.now()`. Save.
- Return `{ storeToken, storeUrl: \`${process.env.CLIENT_URL}/marketplace/store/${storeToken}\` }`.

**Route:** `POST /api/kyc/generate-store-token` — protected by `protect` middleware.

---

#### `controllers/buyerAuthController.js`

**`registerBuyer(req, res)`**
- Validate required fields (`firstName`, `lastName`, `email`, `password`).
- Check `Buyer.findOne({ email })` — return 400 if exists.
- Create buyer, create `BuyerWallet` with `balance: 0`.
- Sign JWT: `jwt.sign({ buyerId: buyer._id }, process.env.BUYER_JWT_SECRET, { expiresIn: "30d" })`.
- Set `buyer_token` cookie (httpOnly, sameSite: "strict"). Return buyer (no password).

**`loginBuyer(req, res)`**
- Find buyer `+password`. Call `buyer.matchPassword(req.body.password)`.
- Sign JWT, set cookie. Return buyer.

**`logoutBuyer(req, res)`**
- Clear `buyer_token` cookie. Return 200.

**`getBuyerMe(req, res)`**
- Return `req.buyer` (set by `buyerAuthMiddleware`).

---

#### `middleWare/buyerAuthMiddleware.js`

```javascript
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const Buyer = require("../models/buyerModel");

const protectBuyer = asyncHandler(async (req, res, next) => {
  let token = req.cookies.buyer_token;
  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    res.status(401);
    throw new Error("Not authorised as buyer");
  }
  const decoded = jwt.verify(token, process.env.BUYER_JWT_SECRET);
  req.buyer = await Buyer.findById(decoded.buyerId).select("-password");
  if (!req.buyer) {
    res.status(401);
    throw new Error("Buyer not found");
  }
  next();
});

module.exports = { protectBuyer };
```

Add `BUYER_JWT_SECRET` to `.env`.

---

#### `controllers/buyerMarketplaceController.js`

**`getListings(req, res)`**
- Accept query params: `search`, `category`, `minPrice`, `maxPrice`, `page`, `limit` (default 20), `storeToken`.
- If `storeToken` provided: find `BusinessKyc` by token, filter products to that business only.
- Otherwise: find all `BusinessKyc` where `status === "approved"`, get their `business` IDs.
- Query `Product.find({ business: { $in: approvedBusinessIds }, listProduct: true, productIsaGroup: false })`.
  - Apply search: `name` regex (case-insensitive).
  - Apply category/price filters.
- For each product compute `availableQty = product.quantity - product.activeMarketplaceHoldQty`.
- Use `utils/cursorPagination.js` for pagination.
- Response: `{ products, pagination, storeName? }`.

**`getProductDetail(req, res)`**
- Find product by `productId`. Verify its business has an approved KYC.
- Return product with `availableQty`.

**`getStoreInfo(req, res)`**
- Find `BusinessKyc` by `storeToken`. Verify `status === "approved"`.
- Populate `business` (name, address). Return store metadata.

**`createOrUpdateCartHold(req, res)`** — requires `protectBuyer`
- Body: `{ productId, quantity }`.
- Find product. Verify business is KYC-approved.
- Compute available = `product.quantity - product.activeMarketplaceHoldQty`.
- Check for existing active hold with `source: "buyer_cart"` and matching `buyer` (use session ID or `req.buyer._id`).
  - If exists: release old hold, create new hold with updated quantity.
  - If not: create new hold.
- Use existing `inventoryHoldService.createLineHold()` — pass `source: "buyer_cart"` and `expiresAt: Date.now() + 5 * 60 * 1000`.
- Emit a `inventory.updated` event via `eventBus.emitBusinessEvent` so business inventory syncs in real-time.
- Return updated hold + available qty.

**`releaseCartHold(req, res)`** — requires `protectBuyer`
- Find active `buyer_cart` hold for `req.buyer._id` + `productId`. Release it via `inventoryHoldService.releaseLineHold()`.
- Emit `inventory.updated` event.

**`getCartHolds(req, res)`** — requires `protectBuyer`
- Find all active `buyer_cart` holds for `req.buyer._id`. Populate product details.

**`checkout(req, res)`** — requires `protectBuyer`
- Body: `{ paymentReference, shippingAddress }` — payment is confirmed externally (Paystack etc.) before hitting this endpoint.
- Validate `paymentReference` (call payment gateway to verify amount).
- Group active cart holds by `business`.
- For each business group:
  1. Create one `InternalMarketplaceOrder` with status `"payment_confirmed"`.
  2. Create one `EscrowEntry` with `status: "held"` and `amount = subtotal for that business`.
  3. Attach `escrowEntryId` to the order.
  4. Mark cart holds as `"consumed"` (use `inventoryHoldService.consumeOrderHolds()`).
  5. Emit `marketplace.internal_order.placed` event to the business via `eventBus.emitBusinessEvent`.
- Shared `checkoutSessionRef = uuid()` tied across all orders.
- Return `{ orders: [...], checkoutSessionRef }`.

**`getBuyerOrders(req, res)`** — requires `protectBuyer`
- Query `InternalMarketplaceOrder.find({ buyer: req.buyer._id })`. Populate `business` (name). Sort by `createdAt desc`.

**`getBuyerOrderDetail(req, res)`** — requires `protectBuyer`
- Find by `orderId` and verify `buyer === req.buyer._id`.

---

#### `controllers/internalMarketplaceOrderController.js` (business-side)

**`listInternalOrders(req, res)`** — protected by `protect`
- Query `InternalMarketplaceOrder.find({ business: req.business._id, status: req.query.status || undefined })`. Paginate.

**`getInternalOrder(req, res)`**
- Find by `orderId` and `business: req.business._id`.

**`decideInternalOrder(req, res)`**
- Body: `{ decision: "accepted" | "rejected", reason? }`.
- Find order by `orderId` and `business`.
- Current status must be `"payment_confirmed"`.
- **If accepted:**
  1. Set `status = "accepted"`.
  2. Find `EscrowEntry` by `order`. Set `status = "released_to_business"`, `settledAt = now`.
  3. Find or create `BusinessWallet` for this business. Add `amount` to `balance`. Push credit transaction.
  4. Set `buyer_notified_at = now`.
  5. Emit `marketplace.internal_order.accepted` event to buyer session (see §1.8 below).
- **If rejected:**
  1. Set `status = "rejected"`, `rejectionReason = reason`.
  2. Find `EscrowEntry`. Set `status = "refunded_to_buyer"`.
  3. Find `BuyerWallet`. Add `amount` to `balance`. Push credit transaction with `reason = "Order rejected by {businessName}: {reason}"`.
  4. Release any remaining holds via `inventoryHoldService.releaseOrderHolds()`.
  5. Set `buyer_notified_at = now`.
  6. Emit `marketplace.internal_order.rejected` event to buyer.
- Return updated order.

**Routes** — add to existing marketplace route group with `protect`:
```
GET    /api/marketplace/internal-orders
GET    /api/marketplace/internal-orders/:orderId
POST   /api/marketplace/internal-orders/:orderId/decide
POST   /api/marketplace/internal-orders/:orderId/status    (advance: processing → shipped → delivered)
```

---

#### `controllers/businessWalletController.js`

**`getBalance(req, res)`**
- Find `BusinessWallet` for `req.business._id`. Return `balance` and `currency`.

**`getTransactions(req, res)`**
- Return paginated `transactions` array from wallet.

**`requestWithdrawal(req, res)`**
- Body: `{ amount, bankName, accountNumber, accountName }`.
- Validate `amount <= wallet.balance`.
- Deduct `amount` from `balance`. Push debit transaction with `type: "withdrawal"`.
- TODO: trigger actual bank transfer via payment gateway (Paystack Transfer API).
- Return updated balance.

---

#### Admin middleware — `middleWare/adminMiddleware.js`

Create a simple admin guard. The admin is identified by a hardcoded email list in env (`ADMIN_EMAILS=email1,email2`) or a separate admin token.

```javascript
const adminMiddleware = (req, res, next) => {
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim());
  // Reuse existing protect middleware first, then check
  if (!req.business || !adminEmails.includes(req.business.businessEmail)) {
    res.status(403);
    throw new Error("Admin access required");
  }
  next();
};
```

Mount admin KYC routes as: `protect` → `adminMiddleware` → controller.

---

### 1.5 `server.js` Changes

Add the following route mounts in the routes section:

```javascript
const kycRoute = require("./routes/kycRoute");
const buyerAuthRoute = require("./routes/buyerAuthRoute");
const buyerMarketplaceRoute = require("./routes/buyerMarketplaceRoute");
const buyerWalletRoute = require("./routes/buyerWalletRoute");

app.use("/api/kyc", kycRoute);
app.use("/api/buyer/auth", buyerAuthRoute);
app.use("/api/buyer/marketplace", buyerMarketplaceRoute);
app.use("/api/buyer/wallet", buyerWalletRoute);
```

Add `BUYER_JWT_SECRET` to env and `.env.example`.

---

### 1.6 Inventory Hold: 5-Minute Cart Holds

The `inventoryHoldService.createLineHold()` already accepts an `expiresAt` parameter. When creating cart holds, pass:
```javascript
expiresAt: new Date(Date.now() + CART_HOLD_DURATION_MINUTES * 60 * 1000)
```

The existing `expireStaleHolds()` will automatically clean them up during the 15-minute sweep.

**Important:** Cart holds must be released if:
1. Buyer explicitly removes an item from cart (`DELETE /cart/hold/:productId`).
2. Hold expires naturally (handled by sweeper).
3. Checkout is completed (holds become `"consumed"`).

---

### 1.7 Real-time Inventory Sync to Marketplace

Whenever a cart hold is created, updated, or released on a product, emit an event so the business's real-time feed — and the public marketplace — reflects the new `availableQty`.

In `buyerMarketplaceController.js`, after any hold operation:
```javascript
await eventBus.emitBusinessEvent(
  "inventory.hold_updated",
  product.business.toString(),
  {
    productId: product._id.toString(),
    availableQty: product.quantity - product.activeMarketplaceHoldQty,
  }
);
```

The existing `WebSocketManager` and `SSEManager` will deliver this to connected business clients. The public marketplace frontend needs to listen to a separate public channel (see §2.5).

---

### 1.8 Buyer Real-time Notifications

The existing WebSocket/SSE infrastructure is scoped to `businessId`. For buyer notifications, add a separate buyer channel in `WebSocketManager.js` and `SSEManager.js`:

- Buyer connects with their `buyer_token` on `?token=<buyer_token>`.
- Add a `buyerClients` Map alongside the existing `businessClients` Map.
- On `marketplace.internal_order.accepted` / `marketplace.internal_order.rejected`: call `notifyBuyer(buyerId, event)`.
- The buyer frontend subscribes over WebSocket or SSE and updates the order status in the buyer dashboard.

In both `WebSocketManager.js` and `SSEManager.js`:
1. During token verification, detect if the token is a buyer token (try `BUYER_JWT_SECRET`, fall back to `JWT_SECRET`).
2. If buyer token: register in `buyerClients` map keyed by `buyerId`.
3. Add `notifyBuyer(buyerId, type, data)` method.

---

### 1.9 Environment Variables to Add

```
BUYER_JWT_SECRET=<random strong secret>
ADMIN_EMAILS=admin@yourdomain.com
CLIENT_URL=https://app.sellsquare.io    # used for store link generation
```

---

## Part 2 — Frontend (Business Dashboard)

### 2.1 Marketplace Setup Tab

**Add to sidebar** (`client/src/data/sidebar.js`):

In the `Marketplace` menu children array, add a `Setup` entry before `Orders`:
```javascript
{
  title: "Setup",
  path: "/marketplace/setup",
  icon: /* gear/settings SVG */,
},
```

**Create `client/src/pages/product/marketplace/Setup.js`**

This page has two states:

**State A — KYC not yet approved:**
Render a multi-step form with these fields:
- Owner full name, National ID number, ID document upload
- Business registration number, Business registration document upload
- Business address (street, city, state)
- Bank account name, account number, bank name

On submit: `POST /api/kyc/submit` (multipart/form-data).

After submit: show status banner:
- `submitted` / `under_review`: "Your documents are under review. We'll notify you once approved."
- `rejected`: Red banner with rejection reason + "Update and Resubmit" button that re-enables the form.
- `approved`: Green banner. Show "Generate Store Link" button.

**State B — KYC approved:**
Show green approval badge + store link section:
```
Your marketplace store is approved.

[Generate Store Link]   (disabled/greyed until clicked; shows spinner while generating)

Once generated:
Store Link: https://app.sellsquare.io/marketplace/store/abc123...
[Copy Link]
```

The "Generate Store Link" button calls `POST /api/kyc/generate-store-token`. The response gives `storeUrl`. Display it with a copy button. Once generated, the button becomes "Regenerate" (same call, idempotent).

**Add route** in `App.js`:
```javascript
import MarketplaceSetup from "./pages/product/marketplace/Setup";
// inside the authenticated route tree:
<Route path="/marketplace/setup" element={<MarketplaceSetup />} />
```

---

### 2.2 Marketplace > Wallet (Business)

The existing `client/src/pages/product/marketplace/Wallet.js` is a stub. Wire it to real data:

1. Create a `businessWalletService.js` in `client/src/services/`:
   ```javascript
   import axios from "../utils/axiosConfig";
   const getBalance = () => axios.get("/api/marketplace/wallet/balance");
   const getTransactions = (params) => axios.get("/api/marketplace/wallet/transactions", { params });
   const requestWithdrawal = (data) => axios.post("/api/marketplace/wallet/withdraw", data);
   export default { getBalance, getTransactions, requestWithdrawal };
   ```
2. In `Wallet.js`: fetch balance and transactions on mount. Show balance, transaction history, and a withdrawal form (amount + bank details).
3. Use `useAsyncButton` from `client/LOADING_STATES_GUIDE.md` for the withdrawal submit button.

---

### 2.3 Internal Marketplace Orders — New Sub-Tab

The existing **Orders** page (`Orders.js`) shows partner API orders. The new internal buyer orders need their own sub-tab.

**Option:** Add a tab switcher to the existing `Orders.js` (or create `InternalOrders.js` as a sibling page).

Recommended approach — add a `source` toggle at the top of `Orders.js`:
- "Partner Orders" tab → existing `fetchBulkMarketplaceOrders()` flow
- "Buyer Orders" tab → new `fetchBulkInternalOrders()` thunk

**Add to `bulkDataCacheSlice.js`** (follow exact same pattern as `marketplaceOrders`):
- Add `internalMarketplaceOrders` data type.
- Thunk: `fetchBulkInternalOrders({ force, status })` → calls `GET /api/marketplace/internal-orders`.
- Selectors: `selectInternalOrdersArray`, `selectInternalOrdersMeta`.
- Store as normalized `byId` + `allIds`. Use `ensureArray(...)`.

**Create `client/src/pages/product/marketplace/InternalOrderDetail.js`**
- Shows order lines, buyer details, status, subtotal.
- Action buttons: "Accept Order" / "Reject Order" (with reason textarea for rejection).
- Both call `POST /api/marketplace/internal-orders/:orderId/decide`.
- Status advancement buttons for accepted orders: "Mark Processing" → "Mark Shipped" → "Mark Delivered".
- Use `useAsyncButton` for all action buttons.
- On success: re-fetch `internalMarketplaceOrders`.

**Add routes** in `App.js`:
```javascript
<Route path="/marketplace/buyer-orders" element={<InternalOrders />} />
<Route path="/marketplace/buyer-orders/:orderId" element={<InternalOrderDetail />} />
```

And add to sidebar under Marketplace children:
```javascript
{ title: "Buyer Orders", path: "/marketplace/buyer-orders", icon: /* receipt icon */ }
```

---

## Part 3 — Frontend (Public Marketplace)

The files `Marketplace.jsx`, `ProductDetail.jsx`, and `Cart.jsx` in `client/src/pages/web/Marketplace/` are UI mockups with hardcoded data. Replace their mock data with real API calls.

### 3.1 Buyer Auth Pages

Create `client/src/pages/web/Marketplace/BuyerLogin.jsx` and `BuyerRegister.jsx`.

- Use a `buyerAuthService.js` in `client/src/services/`:
  ```javascript
  import axios from "../utils/axiosConfig";
  const register = (data) => axios.post("/api/buyer/auth/register", data);
  const login = (data) => axios.post("/api/buyer/auth/login", data);
  const logout = () => axios.post("/api/buyer/auth/logout");
  const getMe = () => axios.get("/api/buyer/auth/me");
  export default { register, login, logout, getMe };
  ```
- Store buyer session in a `buyerAuth` Redux slice (`client/src/redux/features/buyerAuth/buyerAuthSlice.js`).
  - State: `{ buyer: null | BuyerObject, isLoading, isAuthenticated }`.
  - Thunks: `loginBuyer`, `registerBuyer`, `logoutBuyer`, `restoreBuyerSession` (calls `/me` on load).
- On `App.js` mount: dispatch `restoreBuyerSession()` (similar to how business auth session is restored).

Add routes in `App.js`:
```javascript
<Route path="/marketplace/login" element={<BuyerLogin />} />
<Route path="/marketplace/register" element={<BuyerRegister />} />
```

---

### 3.2 Marketplace.jsx — Wire to Real Data

Replace all hardcoded product arrays with a `buyerMarketplaceService.js`:
```javascript
import axios from "../utils/axiosConfig";
const getListings = (params) => axios.get("/api/buyer/marketplace/products", { params });
const getProductDetail = (productId) => axios.get(`/api/buyer/marketplace/products/${productId}`);
const getStoreInfo = (storeToken) => axios.get(`/api/buyer/marketplace/store/${storeToken}`);
const createOrUpdateHold = (data) => axios.post("/api/buyer/marketplace/cart/hold", data);
const releaseHold = (productId) => axios.delete(`/api/buyer/marketplace/cart/hold/${productId}`);
const getCartHolds = () => axios.get("/api/buyer/marketplace/cart/holds");
const checkout = (data) => axios.post("/api/buyer/marketplace/orders/checkout", data);
const getBuyerOrders = () => axios.get("/api/buyer/marketplace/orders");
const getBuyerOrderDetail = (orderId) => axios.get(`/api/buyer/marketplace/orders/${orderId}`);
export default { getListings, getProductDetail, getStoreInfo, createOrUpdateHold, releaseHold, getCartHolds, checkout, getBuyerOrders, getBuyerOrderDetail };
```

In `Marketplace.jsx`:
1. On mount, call `getListings()` with current filter/search/page state.
2. Replace hardcoded product cards with API results.
3. Show `availableQty` on each card. If `availableQty === 0`, show "Out of Stock".
4. On page load, check URL for `?store=<storeToken>` param. If present, call `getStoreInfo(token)` and pass `storeToken` to `getListings()`. Show store name banner at top.

---

### 3.3 Store-Filtered View

The existing route `/marketplace` becomes the full marketplace. Add `/marketplace/store/:storeToken` as an alias:

In `App.js`:
```javascript
<Route path="/marketplace/store/:storeToken" element={<Marketplace />} />
```

In `Marketplace.jsx`: read `useParams().storeToken` (if present). If set, pass it to all API calls so only that business's products show.

The `storeToken` must be passed on every listing API call so the backend filters correctly. The buyer should never see products from other businesses while on a store link.

---

### 3.4 Cart.jsx — Wire to Real Data

Replace `allCartItems` mock array with state driven by the cart holds API:

1. On mount (if buyer authenticated): call `getCartHolds()`. Populate cart from holds.
2. When buyer changes quantity: call `createOrUpdateHold({ productId, quantity })`. On success, emit a hold refresh.
3. When buyer removes item: call `releaseHold(productId)`.
4. **Hold timer display:** Each cart item should show a countdown "Reserved for X:XX" based on the hold's `expiresAt`. When the timer hits 0, show "Reservation expired — item may no longer be available" and re-check availability.
5. If buyer is not authenticated: prompt to log in before proceeding to checkout.

**Checkout flow:**
1. Trigger payment (integrate Paystack or similar) client-side to get a `paymentReference`.
2. On payment success: call `checkout({ paymentReference, shippingAddress })`.
3. Navigate to `/marketplace/orders` (buyer orders page).

---

### 3.5 ProductDetail.jsx — Wire to Real Data

Replace hardcoded product with `getProductDetail(productId)`. Show `availableQty`. "Add to Cart" button calls `createOrUpdateHold({ productId, quantity: 1 })`.

---

### 3.6 Buyer Dashboard Pages

Create the following pages under `client/src/pages/web/Marketplace/`:

**`BuyerOrders.jsx`** — lists all buyer orders grouped by `checkoutSessionRef`. Shows per-business order status.

**`BuyerOrderDetail.jsx`** — shows lines, amounts, status. If status is `"rejected"`: shows reason and "Funds have been returned to your wallet."

**`BuyerWallet.jsx`** — shows balance, transaction history, and a withdrawal form.

**Routes** in `App.js`:
```javascript
<Route path="/marketplace/buyer/orders" element={<BuyerOrders />} />
<Route path="/marketplace/buyer/orders/:orderId" element={<BuyerOrderDetail />} />
<Route path="/marketplace/buyer/wallet" element={<BuyerWallet />} />
```

These pages should redirect to `/marketplace/login` if buyer is not authenticated (create a `BuyerProtectedRoute` wrapper similar to the existing `PrivateRoute`).

---

### 3.7 Real-time Notifications for Buyer

In the buyer dashboard, open a WebSocket or SSE connection authenticated with the buyer token:

```javascript
// In a useBuyerRealtimeHook.js custom hook:
useEffect(() => {
  const token = /* get buyer token from cookie or Redux state */;
  const ws = new WebSocket(`wss://api.sellsquare.io/ws?token=${token}`);
  ws.onmessage = (msg) => {
    const event = JSON.parse(msg.data);
    if (event.type === "marketplace.internal_order.accepted") {
      // Show toast: "Your order from {businessName} has been accepted!"
      // Refresh orders list
    }
    if (event.type === "marketplace.internal_order.rejected") {
      // Show toast: "Order from {businessName} was rejected. Funds returned to wallet."
      // Refresh orders list and wallet balance
    }
  };
  return () => ws.close();
}, []);
```

---

### 3.8 Real-time Inventory on Marketplace Page

Subscribe to `inventory.hold_updated` events on the public marketplace page so available quantities update without a page refresh. The public marketplace can use a public SSE channel (no auth required) scoped to "all approved businesses" — or simply poll every 30 seconds as a simpler fallback.

**Recommended simpler approach:** On the `Marketplace.jsx` page, set a 30-second polling interval that re-fetches the current page of listings when the user is on the page. This avoids adding unauthenticated WebSocket complexity.

---

## Part 4 — Testing Checklist

Work through each scenario after implementation:

### KYC Flow
- [ ] Business submits KYC → status becomes `submitted`
- [ ] Admin lists KYC submissions
- [ ] Admin approves → status becomes `approved`
- [ ] Admin rejects with reason → status becomes `rejected`; business can see reason and resubmit
- [ ] Business cannot generate store token until approved
- [ ] Approved business generates store token → unique token stored
- [ ] Second call to generate store token returns same token (idempotent)
- [ ] Unapproved business products do NOT appear in `GET /api/buyer/marketplace/products`

### Buyer Auth
- [ ] Register → buyer created, wallet created with 0 balance, cookie set
- [ ] Login → cookie set
- [ ] Logout → cookie cleared
- [ ] Unauthenticated request to protected buyer route returns 401

### Listings & Store Link
- [ ] `GET /api/buyer/marketplace/products` returns only products from approved businesses with `listProduct: true`
- [ ] `GET /api/buyer/marketplace/store/:storeToken` returns only that business's products
- [ ] `availableQty` = `quantity - activeMarketplaceHoldQty` for each product

### Cart Holds (5-minute)
- [ ] `POST /cart/hold` with productId + quantity creates an `InventoryHold` with `source: "buyer_cart"` and `expiresAt` ~5 mins from now
- [ ] `product.activeMarketplaceHoldQty` increments correctly
- [ ] Updating quantity: old hold released, new hold created, `activeMarketplaceHoldQty` updates atomically
- [ ] Deleting hold: `activeMarketplaceHoldQty` decrements
- [ ] After 5 minutes (or via the 15-min sweeper): hold status becomes `expired`, `activeMarketplaceHoldQty` decrements
- [ ] `inventory.hold_updated` WebSocket event fires after each hold change

### Checkout & Escrow
- [ ] `POST /orders/checkout` creates one `InternalMarketplaceOrder` per business in cart
- [ ] Each order has a corresponding `EscrowEntry` with `status: "held"`
- [ ] Cart holds are marked `consumed`
- [ ] All orders share same `checkoutSessionRef`
- [ ] `BuyerWallet` unchanged at checkout

### Order Decision — Accept
- [ ] Business calls `POST /internal-orders/:orderId/decide` with `accepted`
- [ ] Order status → `accepted`
- [ ] `EscrowEntry` → `released_to_business`
- [ ] `BusinessWallet.balance` increases by order subtotal
- [ ] `BusinessWallet.transactions` has a credit entry
- [ ] `marketplace.internal_order.accepted` event fires on buyer WebSocket
- [ ] Buyer can see updated status in buyer dashboard

### Order Decision — Reject
- [ ] Business calls decide with `rejected` + reason
- [ ] Order status → `rejected`
- [ ] `EscrowEntry` → `refunded_to_buyer`
- [ ] `BuyerWallet.balance` increases by order subtotal
- [ ] `BuyerWallet.transactions` has a credit entry with rejection reason
- [ ] `marketplace.internal_order.rejected` event fires on buyer WebSocket
- [ ] Buyer sees rejection reason in order detail
- [ ] Buyer wallet balance reflects refund

### Multi-Business Checkout
- [ ] Cart contains items from Business A and Business B
- [ ] Checkout creates 2 orders + 2 escrow entries
- [ ] Business A accepts, Business B rejects
- [ ] Business A wallet credited; buyer wallet credited for Business B's amount

### Business Wallet
- [ ] `GET /marketplace/wallet/balance` returns correct balance
- [ ] `POST /marketplace/wallet/withdraw` deducts from balance if sufficient; fails if amount > balance
- [ ] Transaction history reflects all credits and debits

---

## Part 5 — Pre-Flight Checklist (per CLAUDE.md)

Before marking any endpoint as done:
- [ ] All queries scoped by `req.business` (for business-side endpoints) or `req.buyer` (for buyer-side)
- [ ] Internal marketplace order routes pass through appropriate auth middleware
- [ ] No new `useEffect(() => { dispatch(fetch...) }, [])` loops added in frontend components
- [ ] All Redux reducers use `ensureArray(...)` before storing payloads
- [ ] KYC file uploads use existing `utils/fileUpload.js`
- [ ] No new offset/page pagination — use `utils/cursorPagination.js` on backend
- [ ] Run `npm test` from `webapp/` and `npm run test:ci` from `webapp/client/` before pushing

---

## Part 6 — Implementation Order (Suggested)

Do these in sequence to keep the system functional at every step:

1. **Models** — Add all 5 new models + extend `inventoryHoldModel.js`.
2. **Env** — Add `BUYER_JWT_SECRET`, `ADMIN_EMAILS`, `CLIENT_URL` to `.env`.
3. **Buyer auth** — `buyerModel`, `buyerAuthMiddleware`, `buyerAuthController`, `buyerAuthRoute`. Test registration/login.
4. **KYC backend** — `businessKycModel`, `kycController`, `kycRoute`, admin middleware. Test full KYC lifecycle.
5. **Listings API** — `getListings`, `getProductDetail`, `getStoreInfo` in `buyerMarketplaceController`.
6. **Cart hold API** — `createOrUpdateCartHold`, `releaseCartHold`, `getCartHolds`. Test hold creation and expiry.
7. **Checkout + escrow** — `checkout` endpoint, `EscrowEntry` creation, all models.
8. **Internal orders (business side)** — `internalMarketplaceOrderController`, routes, Redux slice, `InternalOrders.js` page.
9. **Wallet backends** — `businessWalletController`, `buyerWalletController`.
10. **Buyer real-time** — Extend `WebSocketManager`/`SSEManager` with buyer channel.
11. **Store token** — `storeTokenController` endpoint.
12. **Frontend: Setup tab** — KYC form + approval status + store link UI.
13. **Frontend: Business Wallet** — Wire `Wallet.js`.
14. **Frontend: Buyer Auth** — Login/Register pages + Redux slice.
15. **Frontend: Marketplace.jsx** — Real data, store-link filter, availability.
16. **Frontend: Cart.jsx** — Hold-driven cart, countdown timers, checkout flow.
17. **Frontend: Buyer Dashboard** — Orders, wallet pages.
18. **Frontend: Buyer Notifications** — WebSocket hook.
19. **Testing** — Full checklist from Part 4.
