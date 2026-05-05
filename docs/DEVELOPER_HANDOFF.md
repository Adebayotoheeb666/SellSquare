# SellSquare Developer Handoff

## Purpose

This document is the quickest way for a new developer to understand how SellSquare is structured, how the major pieces connect, and which parts of the system have seen the most recent work.

The repository is a full-stack JavaScript application with:

- an Express + MongoDB backend in the repo root
- a React + Redux frontend in `client/`
- a realtime layer built on WebSockets, Server-Sent Events, and MongoDB change streams
- a public marketplace API with partner authentication, idempotent order creation, and webhook fanout

---

## 1. High-Level Architecture

### Runtime shape

1. `server.js` boots the Express app, applies middleware, mounts all API routes, exposes the realtime SSE endpoint, connects to MongoDB, and starts background jobs plus realtime infrastructure.
2. The backend uses route modules in `routes/`, controller modules in `controllers/`, Mongoose models in `models/`, and focused domain services in `services/`.
3. The frontend boots from `client/src/App.js`, splits public routes from authenticated routes, and wraps all protected routes in a persistent `Layout` component.
4. `Layout` starts the session-scoped bootstrap process through `client/src/customHook/useDataBootstrap.js` so critical datasets load once per login instead of on every page mount.
5. Once bootstrap is complete, `client/src/customHook/useRealtime.js` opens a realtime connection through `client/src/services/realtimeClient.js` and pushes server events into Redux.
6. Redux slices then either update cached datasets directly or mark them stale for manual refresh, depending on the event type.

### Core request and event flow

Typical mutation flow looks like this:

`Route -> auth/validation middleware -> controller -> model/service -> event middleware and/or Mongo change stream -> EventBus -> WebSocket/SSE clients -> Redux realtime slice -> UI refresh or cache invalidation`

This matters because SellSquare does not rely only on request/response updates. Many screens assume:

- session bootstrap loads the initial state
- realtime events keep that state fresh
- client-side pagination works from locally cached bulk datasets

---

## 2. Repository Map

### Backend root

| Path | Role |
|---|---|
| `server.js` | Main backend entry point, Express boot, Mongo connection, realtime initialization, jobs, static client serving in production |
| `routes/` | Express route declarations grouped by feature |
| `controllers/` | Request handlers and orchestration logic |
| `models/` | Mongoose schemas for business, product, cart, checkout, marketplace, auth, and support entities |
| `middleWare/` | Auth, error handling, route logging, public marketplace auth/signing/rate-limit/idempotency middleware |
| `services/` | Domain services, especially marketplace-specific logic and variant repair support |
| `events/` | Event bus, WebSocket manager, SSE manager, change stream manager, event middleware |
| `jobs/` | Background jobs for marketplace hold expiry and variant identity repair |
| `utils/` | Shared helpers for upload, logging, email, cron, security, history tracking, and other cross-cutting concerns |
| `validators/` | Validation logic, including marketplace request schemas |
| `__tests__/` | Backend unit, integration, middleware, event, service, and marketplace tests |
| `docs/` | Architecture notes, rollout plans, contracts, security notes, and this handoff |

### Frontend

| Path | Role |
|---|---|
| `client/src/App.js` | Frontend route entry point; wires public pages, protected pages, axios auth handling, and realtime manager |
| `client/src/components/` | Shared UI building blocks, persistent layout, protected wrappers, product/cart widgets, realtime helpers |
| `client/src/pages/product/` | Authenticated product/business workspace pages |
| `client/src/pages/web/` | Public marketing, blog, contact, policy, and marketplace pages |
| `client/src/redux/` | Store setup plus feature slices for auth, products, cart, discounts, admin, expenses, realtime, and cache state |
| `client/src/customHook/` | Bootstrap, realtime, refresh guard, and page-specific hooks |
| `client/src/services/` | Frontend API wrappers for auth, product, expense, discount, marketplace, and realtime |
| `client/src/__tests__/` | Frontend unit and behavior tests, especially around auth hygiene, realtime, cache bootstrap, and marketplace screens |

---

## 3. Backend Structure and Connections

### 3.1 Entry point

`server.js` is the central composition root. It does the following:

- loads environment variables
- configures JSON parsing, cookies, body parsing, CORS, and route logging
- mounts API routes under `/api/*`
- mounts realtime SSE routes under `/api/realtime`
- serves `uploads/` statically
- serves the React build in production/staging
- connects to MongoDB
- initializes WebSocket support on the HTTP server
- initializes MongoDB change streams for critical collections
- starts background jobs
- starts marketplace webhook fanout and listing bridge listeners
- handles graceful shutdown

### 3.2 Route modules

Main route groupings:

- `routes/businessRoute.js`: registration, login/logout, business profile, password reset, subscriptions, sales reps, admin messaging, connected stores
- `routes/productRoute.js`: products, product groups, dashboard stats, sales, out-of-stock, bulk operations, listing option updates
- `routes/cartRoute.js`: POS/cart and checkout workflows
- `routes/expenseRoute.js`: expense CRUD and expense reporting
- `routes/discountRoute.js`: discount creation and management
- `routes/blogRoute.js`: public/internal blog operations
- `routes/contactRoute.js`: contact and messaging endpoints
- `routes/applicationRoute.js`: applications and brief/workflow-related endpoints
- `routes/publicMarketplaceRoute.js`: public marketplace partner APIs plus internal marketplace management endpoints

### 3.3 Controllers and models

Controllers are still fairly large and do a lot of orchestration. The project is functional, but several feature areas are controller-heavy rather than service-heavy.

Important controller/model pairs:

- `businessController.js` + `businessRegistration.js`: authentication, business account data, subscription state, stores, admin capabilities
- `productController.js` + `productModel.js` / `productGroupModel.js`: inventory, product groups, sales metrics, listing flags, image normalization, dashboard stats, low stock/out-of-stock logic
- `cartController.js` + `cartModel.js` / `checkOutSalesModel.js`: cart state, checkout, fulfilment, customer-facing sales records
- `discountController.js` + `discountModel.js`: marketplace and sales discounts
- `expenseController.js` + `expenseModel.js`: business expense tracking
- `publicMarketplaceOrderController.js` + `marketplaceOrderModel.js` / `inventoryHoldModel.js`: external order intake, line resolution, holds, payment confirmation, status transitions, fulfilment handoff
- `publicMarketplaceAuthController.js` + `publicApiCredentialModel.js` / `publicRefreshSessionModel.js` / `publicRequestNonceModel.js`: partner credentials, signed token exchange, refresh rotation, revocation
- `marketplaceWebhookAdminController.js` + `marketplaceWebhookEndpointModel.js` / `marketplaceWebhookDeliveryModel.js`: webhook endpoint management and delivery observability

### 3.4 Middleware layers

The backend relies heavily on middleware to keep route handlers manageable.

Key middleware:

- `authMiddleware.js`: session protection for internal APIs
- `errorMiddleware.js`: central error responses
- `routeLoggerMiddleware.js`: logs incoming API traffic
- `publicPartnerAuthMiddleware.js`: bearer token validation for marketplace partners
- `publicRequestSigningMiddleware.js`: verifies signed token-issue requests
- `publicRateLimitMiddleware.js`: partner/IP throttling
- `publicIdempotencyMiddleware.js`: protects order creation from duplicate retries
- `publicDomainAllowlistMiddleware.js`: enforces partner domain restrictions
- `publicAuditMiddleware.js`: audit trail for public API actions
- `requireBusinessOwner.js`: owner-only protection for management endpoints

### 3.5 Services and background jobs

The `services/marketplace/` area contains the most domain-focused backend logic. It is one of the better-organized subsystems in the repo.

Key marketplace services:

- line identity resolution
- discount resolution
- order state transition validation
- inventory hold reservation/expiry/consumption
- checkout fulfilment bridge
- webhook event building and signed dispatch
- listing snapshot building and listing-update event bridge
- idempotency completion/replay logic

Jobs currently in play:

- `jobs/marketplaceHoldExpiryJob.js`: expires stale reserved inventory holds
- `jobs/variantIdentityRepairJob.js`: supports product group variant identity repair/migration work

---

## 4. Realtime System

The realtime system is a first-class part of the application, not an optional add-on.

### Backend side

The `events/` folder contains:

- `EventEmitter.js`: the internal business-scoped event bus and event helpers
- `eventMiddleware.js`: emits events around route-level mutations
- `WebSocketManager.js`: authenticated WebSocket broadcast layer
- `SSEManager.js`: SSE fallback and subscription layer
- `ChangeStreamManager.js`: MongoDB change stream watcher for products, product groups, discounts, checkouts, carts, activities, expenses, and businesses

Realtime events are produced from two main sources:

1. mutation middleware attached directly to routes
2. MongoDB change streams attached after app startup

This dual-source design is intentional, but it also creates duplicate-event risk. Recent hardening work added dedupe keys and semantic dedupe behavior to reduce repeated client updates.

### Frontend side

Important files:

- `client/src/services/realtimeClient.js`: connection manager with WebSocket-first, SSE-fallback behavior, reconnect logic, and subscriber support
- `client/src/customHook/useRealtime.js`: opens the connection only after login + bootstrap and exposes invalidation helpers
- `client/src/redux/features/realtime/realtimeSlice.js`: event routing, idempotency tracking, connection state, and cache invalidation flags

Important behavioral assumptions:

- protected route layout is intentionally persistent so the realtime connection is not torn down on each page navigation
- the app connects only after critical bootstrap is complete
- some events patch Redux data directly, while others only mark datasets stale and rely on user-triggered refresh

---

## 5. Frontend Structure and State Model

### 5.1 Routing

`client/src/App.js` is the main route map.

Public routes include:

- landing/home
- blog and blog posts
- about/contact/policy/terms
- marketing interns flow
- public marketplace pages
- login/register/forgot/reset flows

Protected routes include:

- dashboard
- inventory and product detail pages
- add/edit product and product group pages
- cart, fulfilments, customers, activities, expenses
- account/business management pages
- admin pages
- marketplace owner/operator pages for orders, discounts, and wallet

The `ProtectedLayout` pattern is important: `Layout` mounts once and keeps session bootstrap + realtime stable across protected-route navigation.

### 5.2 Session bootstrap and cache model

The biggest frontend architectural choice is session-scoped data caching.

Important files:

- `client/src/components/layout/Layout.js`: triggers `useDataBootstrap()` and session lifecycle behavior
- `client/src/customHook/useDataBootstrap.js`: loads critical datasets first, then bulk background datasets
- `client/src/redux/features/dataCache/dataCacheSlice.js`: bootstrap flags, fetch state, stale markers, per-page cache metadata
- `client/src/redux/features/dataCache/bulkDataCacheSlice.js`: bulk-loaded datasets used for client-side pagination
- `client/src/redux/sessionReset.js`: authoritative logout/session-reset cleanup path

Key design decisions:

- critical datasets load once per login
- larger datasets are bulk-loaded in the background
- UI pagination is mostly client-side once datasets are loaded
- realtime invalidation is used to avoid naive full refetching
- logout resets Redux, local storage caches, and auth session artifacts

This is a major architectural theme. Anyone changing data loading needs to understand it before introducing new fetch patterns.

### 5.3 Redux slices

The store is configured in `client/src/redux/store.js`.

Major slices:

- `auth`: login/session/business identity
- `product`: product CRUD state plus dashboard/product-derived data
- `productCache`: search dataset and product background loading metadata
- `bulkDataCache`: bulk datasets for sales, expenses, activities, fulfilments, customers, product groups, discounts, out-of-stock, marketplace orders
- `cart`: cart, checkout, and customer-related state
- `expense`: expense workflows
- `discount`: discount CRUD state
- `realtime`: connection state and event handling
- `admin`: super-admin business/application data
- `filter`: inventory/filter state

### 5.4 Frontend service layer

Frontend API wrappers live in `client/src/services/`.

Key files:

- `authService.js` and `authServiceOptimized.js`
- `marketplaceService.js`
- `discountService.js`
- `expenseService.js`
- `blogService.js`
- `applicationService.js`

The services are fairly thin axios wrappers. Most complexity lives in Redux thunks/hooks and backend controllers.

---

## 6. Major Feature Areas

### Inventory and product groups

This is still the core of the application.

Capabilities already present:

- product CRUD
- product group CRUD
- image upload handling
- sales and low-stock reporting
- dashboard statistics
- client-side search/filter support
- listing flags for marketplace exposure
- bulk actions such as delete/toggle

The product controller is also where variant identity handling is evolving. There is active work around preserving stable variant identities for product groups.

### POS, cart, checkout, and fulfilment

Cart and checkout data flows feed both inventory operations and downstream business reporting. These flows are also connected to realtime updates, so cart/sales changes can propagate quickly to active sessions.

### Business account and subscriptions

Business auth, password flows, subscription plan handling, sales rep management, business activities, and connected-store logic are owned by the business routes/controllers.

### Public website and content

Public pages, blog, contact, policy, terms, and marketing-intern content live under `client/src/pages/web/` and corresponding backend routes/controllers where needed.

### Public marketplace subsystem

This is one of the most actively developed parts of the system.

Implemented pieces include:

- partner API credential creation and rotation
- signed token exchange with domain allowlisting
- rotating refresh tokens and revocation
- public listing read endpoints
- external order creation with line identity resolution
- inventory hold reservations to reduce oversell
- payment confirmation and order status transitions
- internal owner-facing order management endpoints
- webhook endpoint management, delivery history, and retry support
- realtime marketplace events and listing-update bridge

Supporting docs:

- `docs/PUBLIC_MARKETPLACE_INTEGRATION.md`
- `docs/PUBLIC_MARKETPLACE_LISTINGS_PERF_ROLLOUT.md`
- `docs/contracts/` for contract-focused materials

---

## 7. What Has Been Done Recently

This section is based on the current code plus the docs in `docs/`.

### Completed or actively landed

1. Public Marketplace API v1
   - partner auth, scoped bearer tokens, idempotent order creation, webhook management, internal marketplace admin endpoints, and order lifecycle support are all implemented in code

2. Realtime hardening and auth race-condition fixes
   - documented in `docs/SECURITY_HARDENING_NOTES_2026-03-06.md`
   - includes SSE origin hardening, user-scoped filtering parity, refresh rotation hardening, idempotency conflict behavior, event dedupe, webhook dispatch claim semantics, and order reservation race mitigation

3. Marketplace listing performance work
   - documented in `docs/PUBLIC_MARKETPLACE_LISTINGS_PERF_ROLLOUT.md`
   - focuses on listing-query indexes and rollout validation for public marketplace listing performance

4. Session bootstrap and persistent-layout frontend architecture
   - the frontend now assumes a session bootstrap model rather than re-fetching most core data on each navigation
   - realtime connection lifecycle is tied to bootstrap completion and persistent protected layout mounting

5. Webhook fanout and listing event bridge
   - marketplace business events can fan out to webhooks and also drive listing-update events back into the internal realtime pipeline

### Active or in-flight area

1. Product group variant identity stability
   - documented in `docs/RFC_PRODUCT_GROUP_VARIANT_ID_STABILITY.md`
   - this is the clearest current architecture/workflow improvement area for inventory + marketplace consistency
   - the RFC describes preserving variant identity across group edits instead of delete/recreate behavior
   - there is already code and job support around variant-key generation/repair, but treat the RFC as the source of truth for the intended end state

---

## 8. Testing and Quality Signals

### Backend tests

Backend tests live in `__tests__/` and are grouped into:

- `controllers/`
- `events/`
- `helpers/`
- `integration/`
- `marketplace/`
- `middleware/`
- `routes/`
- `services/`

Jest config is in `jest.config.js`. Backend coverage targets controllers, middleware, models, routes, and utils.

### Frontend tests

Frontend tests live in `client/src/__tests__/`.

Current focus areas include:

- auth service behavior
- product service/slice behavior
- realtime event handling
- bootstrap recovery
- logout/session hygiene
- marketplace order detail behavior

### Run commands

Backend:

```bash
npm install
npm run dev
npm test
```

Frontend:

```bash
cd client
npm install
npm start
npm test
```

Backend default port is `4000`. Frontend dev server runs on `3000` and proxies backend requests through the React setup.

---

## 9. Important Files to Read First

For a new developer, this is the best reading order:

1. `README.md`
2. `server.js`
3. `routes/productRoute.js`
4. `routes/businessRoute.js`
5. `routes/publicMarketplaceRoute.js`
6. `events/index.js`
7. `events/ChangeStreamManager.js`
8. `client/src/App.js`
9. `client/src/components/layout/Layout.js`
10. `client/src/customHook/useDataBootstrap.js`
11. `client/src/customHook/useRealtime.js`
12. `client/src/redux/store.js`
13. `docs/PUBLIC_MARKETPLACE_INTEGRATION.md`
14. `docs/SECURITY_HARDENING_NOTES_2026-03-06.md`
15. `docs/RFC_PRODUCT_GROUP_VARIANT_ID_STABILITY.md`

---

## 10. Known Architectural Hotspots

These are not necessarily defects, but they are the areas most likely to need caution.

1. Large controllers
   - `productController.js` and some marketplace/business controllers own a lot of orchestration logic.

2. Realtime dual-source events
   - route middleware and change streams can both emit semantically similar updates. Dedupe exists, but changes in this area should be tested carefully.

3. Session bootstrap assumptions
   - introducing page-level fetches without respecting `dataCache`/`bulkDataCache` can regress performance or create duplicated traffic.

4. Variant identity and cross-entity references
   - product group edits can affect discounts, carts, marketplace listing identity, and order references.

5. Marketplace security paths
   - token issue/refresh/revoke, request signing, and idempotency logic are security-sensitive and should not be changed casually.

---

## 11. Suggested Onboarding Path for the Next Developer

1. Get the backend and frontend running locally.
2. Read the files listed in Section 9 in order.
3. Exercise one full internal workflow: login -> inventory -> cart -> checkout -> dashboard refresh.
4. Exercise one marketplace workflow: create/list API key -> inspect listings -> create order -> confirm payment -> view internal order screen.
5. Review the recent docs in `docs/` before touching realtime, marketplace, or product-group update logic.

If only one idea is retained from this handoff, it should be this: the application is built around session bootstrap + realtime updates + business-scoped events, and the marketplace subsystem is now tightly coupled to inventory identity and order integrity.