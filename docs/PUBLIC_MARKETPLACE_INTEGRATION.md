# Public Marketplace Integration (v1) — Complete Partner Guide

This document is the canonical integration reference for external partners using the Sell Square Public Marketplace API.

It covers everything required for a production-grade integration:

- API credential provisioning
- signed token exchange
- access/refresh token lifecycle automation
- scope-based endpoint authorization
- domain allowlist behavior
- idempotent order creation
- status transitions and fulfillment workflow
- webhook signing and retry model
- error handling and troubleshooting

---

## 1) Integration Overview

### Base path

- All public marketplace routes are mounted at:
  - `/api/public/v1/marketplace`

### Auth models used by this API

1. **Internal Session Auth** (cookie/session auth)
  - Used by authenticated internal users to manage partner credentials and webhook endpoints.
   - Required for:
     - `/auth/keys*`
     - `/webhooks/*`

2. **Partner API Auth**
   - Step A: exchange API key + secret (with request signature) for an access token and refresh token.
   - Step B: call partner endpoints with `Authorization: Bearer <accessToken>`.

### High-level flow

1. Owner creates a credential (`keyId`, one-time `secret`)
2. Partner calls `POST /auth/token` using signed headers
3. API returns short-lived access token + rotating refresh token
4. Partner calls listings/orders APIs with bearer token
5. Partner refreshes tokens via `POST /auth/token/refresh`
6. Partner persists each newly returned refresh token (rotation)

---

## 2) Endpoint & Permission Matrix

| Endpoint | Method | Auth | Scope | Purpose |
|---|---|---|---|---|
| `/auth/keys` | POST | Internal owner session | N/A | Create API credential |
| `/auth/keys` | GET | Internal owner session | N/A | List API credentials |
| `/auth/keys/:keyId` | PATCH | Internal owner session | N/A | Update credential settings |
| `/auth/keys/:keyId/rotate` | POST | Internal owner session | N/A | Rotate API secret |
| `/auth/keys/:keyId/revoke` | POST | Internal owner session | N/A | Revoke credential + refresh sessions |
| `/auth/token` | POST | API key + secret + signature | N/A | Issue access + refresh tokens |
| `/auth/token/refresh` | POST | Refresh token | N/A | Rotate refresh token and issue new access token |
| `/auth/token/revoke` | POST | Refresh token | N/A | Manually revoke a refresh session |
| `/auth/me` | GET | Bearer token | `listings:read` | Inspect token context |
| `/listings` | GET | Bearer token | `listings:read` | List published listings |
| `/listings/:listingId` | GET | Bearer token | `listings:read` | Get listing detail |
| `/orders` | POST | Bearer token | `orders:write` | Create marketplace order |
| `/orders/:orderId/payment-confirm` | POST | Bearer token | `orders:write` | Confirm payment |
| `/orders/:orderId/lines/decision` | POST | Bearer token | `orders:write` | Accept/reject quantities |
| `/orders/:orderId/status` | POST | Bearer token | `orders:write` | Update order status |
| `/orders` | GET | Bearer token | `orders:read` | List orders |
| `/orders/:orderId` | GET | Bearer token | `orders:read` | Get order detail |
| `/webhooks/endpoints` | GET/POST | Internal session | N/A | Manage webhook endpoints |
| `/webhooks/endpoints/:endpointId` | PATCH | Internal session | N/A | Update webhook endpoint |
| `/webhooks/deliveries` | GET | Internal session | N/A | Delivery observability |
| `/webhooks/deliveries/:deliveryId/retry` | POST | Internal session | N/A | Force retry delivery |

---

## 3) Credential Provisioning (Owner/Admin)

### 3.1 Create API credential

`POST /auth/keys`

Request example:

```json
{
  "name": "Partner Production",
  "scopes": ["listings:read", "orders:read", "orders:write", "events:read"],
  "allowlistedDomains": ["partner.example.com", "api.partner.example.com"],
  "rateLimit": {
    "perMinute": 120
  }
}
```

Response example:

```json
{
  "credential": {
    "id": "65f...",
    "keyId": "mkp_9ab...",
    "name": "Partner Production",
    "scopes": ["listings:read", "orders:read", "orders:write", "events:read"],
    "allowlistedDomains": [
      { "domain": "partner.example.com", "isActive": true },
      { "domain": "api.partner.example.com", "isActive": true }
    ],
    "rateLimit": { "perMinute": 120 },
    "status": "active",
    "createdAt": "2026-03-03T09:00:00.000Z"
  },
  "secret": "<shown-once>",
  "warning": "Secret is only returned once. Store it securely."
}
```

### 3.2 Credential defaults and validations

- `scopes` defaults to: `listings:read`, `orders:read`, `orders:write`, `events:read` when omitted.
- `rateLimit.perMinute` defaults to `120`; minimum value is `1`.
- `allowlistedDomains` must be an array of domain strings matching `[a-z0-9.-]+`.
- Secret is hashed + encrypted server-side and never retrievable again.

### 3.3 Rotate secret

`POST /auth/keys/:keyId/rotate`

- Returns a new one-time `secret`.
- Increments `secretVersion`.
- Existing integrations must immediately switch to the new secret for signing and `/auth/token` exchange.

### 3.4 Revoke credential

`POST /auth/keys/:keyId/revoke`

Effects:

- credential status becomes `revoked`
- all non-revoked refresh sessions for that credential are revoked with reason `credential_revoked`
- revoked credential can no longer issue tokens or access partner APIs

---

## 4) Authentication & Token Lifecycle

### 4.1 Token issue endpoint

`POST /auth/token`

Required headers:

- `x-api-key: <keyId>`
- `x-api-secret: <secret>` (can also be supplied in body as `apiSecret`, header preferred)
- `x-partner-timestamp: <epoch_ms>`
- `x-partner-nonce: <unique_nonce>`
- `x-partner-signature: <hex_hmac_sha256>`

Security checks performed:

- API key exists and is active
- credential domain allowlist check (if configured)
- timestamp skew within ±5 minutes
- signature matches expected HMAC payload
- nonce has not been used before for this credential (replay blocked)
- rate limit for credential not exceeded

Success response:

```json
{
  "accessToken": "<jwt>",
  "accessTokenExpiresIn": 900,
  "refreshToken": "<opaque_token>",
  "refreshTokenExpiresAt": "2026-03-17T09:00:00.000Z",
  "keyId": "mkp_9ab...",
  "scopes": ["listings:read", "orders:read", "orders:write", "events:read"]
}
```

Token semantics:

- Access token TTL: `900` seconds (15 minutes)
- Refresh token TTL: `14` days
- Refresh token value is opaque; only hash is persisted server-side

### 4.2 Refresh endpoint (rotating refresh)

`POST /auth/token/refresh`

Request:

```json
{
  "refreshToken": "<latest_refresh_token>"
}
```

Behavior:

- Validates refresh token exists, not expired, not revoked.
- Validates linked credential is still active.
- Issues a new access token.
- Creates a new refresh session.
- Revokes old refresh session with reason `rotated` and links chain (`rotatedFrom` / `replacedBy`).

**Important:** Always persist the newly returned refresh token and discard the old one.

### 4.3 Revoke refresh endpoint

`POST /auth/token/revoke`

Request:

```json
{
  "refreshToken": "<current_refresh_token>"
}
```

Behavior:

- Marks the refresh session revoked with reason `manual_revoke`
- Future refresh attempts with that token fail

### 4.4 Recommended client token strategy

1. Obtain initial tokens through `/auth/token`.
2. Store access token in memory; store refresh token in secure secret storage.
3. Refresh proactively ~2 minutes before access expiry.
4. On `401`, refresh once and retry request once.
5. If refresh fails, re-bootstrap through `/auth/token`.

Pseudocode:

```text
if now >= accessExpiry - 120s:
  tokens = POST /auth/token/refresh(refreshToken)
  persist(tokens.accessToken, tokens.refreshToken, tokens.refreshTokenExpiresAt)

response = call protected API with bearer access token

if response.status == 401:
  tokens = POST /auth/token/refresh(refreshToken)
  persist(tokens...)
  retry original request once
```
 
---

## 5) Request Signing for `POST /auth/token`

### 5.1 Signing payload format

The server verifies this exact payload format:

`METHOD\nPATH\nTIMESTAMP\nNONCE\nSHA256(JSON_BODY)`

Where:

- `METHOD` is uppercase HTTP method (for token issue: `POST`)
- `PATH` is URL path without query string (for token issue: `/api/public/v1/marketplace/auth/token`)
- `TIMESTAMP` is the same value as `x-partner-timestamp`
- `NONCE` is the same value as `x-partner-nonce`
- `JSON_BODY` must match the actual JSON payload sent

For empty body, use `{}` consistently.

### 5.2 Node.js signing example

```javascript
const crypto = require("crypto");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function signTokenIssueRequest({ secret, timestamp, nonce, body = {} }) {
  const method = "POST";
  const path = "/api/public/v1/marketplace/auth/token";
  const bodyString = JSON.stringify(body || {});
  const bodyHash = sha256(bodyString);

  const signingPayload = `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyHash}`;

  return crypto.createHmac("sha256", secret).update(signingPayload).digest("hex");
}
```

### 5.3 Replay protection behavior

- The nonce is persisted per credential.
- Reusing the same nonce for that credential returns `409 Replay request detected`.
- Nonces are TTL-backed and auto-expire in storage.

---

## 6) Domain Allowlist Enforcement

If allowlisted domains are configured on a credential, requests are only accepted when request domain matches an allowlisted domain or its subdomain.

Domain resolution order:

1. `Origin`
2. `Referer`
3. `x-forwarded-origin`
4. `x-forwarded-host` or `Host`

Match rule:

- exact domain match OR subdomain match (`api.partner.example.com` matches `partner.example.com`)

Rejection response:

```json
{
  "message": "Request domain is not allowlisted for this credential",
  "domain": "detected.domain"
}
```

If credential has no allowlist entries, domain check is skipped.

Important production behavior:

- If caller-origin headers are missing (for example server-to-server calls or proxy-terminated requests that only provide `Host`), allowlist enforcement does not hard-fail.
- Strict allowlist enforcement applies whenever caller-origin headers (`Origin`, `Referer`, or `x-forwarded-origin`) are present.

---

## 7) Partner Authenticated Endpoints

All partner endpoints (except token refresh/revoke) require:

- `Authorization: Bearer <accessToken>`
- valid active credential
- required scope(s)
- domain allowlist pass (if configured)
- credential rate-limit pass

### 7.1 `GET /auth/me`

Required scope: `listings:read`

Returns:

```json
{
  "businessId": "...",
  "keyId": "mkp_...",
  "scopes": ["listings:read", "orders:read", "orders:write", "events:read"],
  "credentialStatus": "active"
}
```

---

## 8) Listings API

### 8.1 `GET /listings`

Required scope: `listings:read`

Query params:

- `search` (optional, case-insensitive regex over product/group fields)

Behavior:

- Returns both single products (`listProduct=true`, non-group products) and listed groups (`listGroup=true`).
- Group payload includes listed variants.
- Out-of-stock listings remain visible with stock state.

Response shape:

```json
{
  "listings": [
    {
      "listingType": "single",
      "productId": "...",
      "name": "...",
      "sku": "...",
      "stock": { "quantity": 12, "state": "in_stock" },
      "price": { "base": 1000, "effective": 850, "discount": { "...": "..." } },
      "listed": true
    },
    {
      "listingType": "group",
      "groupId": "...",
      "groupName": "...",
      "stock": { "totalVariants": 3, "hasStock": true, "state": "in_stock" },
      "variants": []
    }
  ],
  "total": 2
}
```

### 8.2 `GET /listings/:listingId`

Required scope: `listings:read`

Behavior:

- Resolves either a listed single product or listed group by ID.
- Returns `404` when not found or not listed.

---

## 9) Orders API

### 9.1 `POST /orders` (Create order)

Required scope: `orders:write`

Recommended headers:

- `Authorization: Bearer <accessToken>`
- `Idempotency-Key: <uuid>`

Request minimum contract:

```json
{
  "partnerOrderRef": "PO-1001",
  "customer": {
    "name": "Jane Doe",
    "phone": "+15550001111",
    "email": "jane@example.com",
    "address": "101 Market Street"
  },
  "lines": [
    {
      "lineId": "line-1",
      "productId": "<listed_product_id>",
      "quantity": 2
    }
  ],
  "paymentId": "optional-payment-ref",
  "trustedPaidFlag": false,
  "partnerPaymentMeta": {
    "gateway": "stripe",
    "intentId": "pi_123"
  }
}
```

Validation rules:

- `lines` must be non-empty.
- each line requires `productId` and `quantity > 0`.
- if `customer` is provided, it must be an object.

Stock/line behavior:

- Product must exist for business and be listed, otherwise `400 INVALID_LISTING_PRODUCT`.
- Active inventory holds are considered when computing available quantity.
- Out-of-stock lines are created as `lineStatus=out_of_stock`, rejected immediately.
- Pending lines create inventory holds.

Payment trust behavior:

- if `paymentId` and `trustedPaidFlag=true` are supplied at create time, order auto-transitions to `payment_confirmed` and warning `TRUSTED_PAID_FLAG_UNVERIFIED` is appended.

Response:

```json
{
  "order": { "...": "full order object" },
  "metadata": {
    "autoPaymentConfirmed": false
  }
}
```

Canonical ID mapping:

- `order._id` is the provider order identifier used for subsequent calls (`/orders/:orderId/*`).
- `order.orderNumber` is a human-friendly reference and may be shown in buyer tracking UI.
- Partners should persist both identifiers.

### 9.2 `POST /orders/:orderId/payment-confirm`

Required scope: `orders:write`

Request example:

```json
{
  "paymentId": "pay_123",
  "trustedPaidFlag": true,
  "partnerPaymentMeta": {
    "gateway": "paystack"
  }
}
```

Behavior:

- Valid transition required (`placed -> payment_confirmed`).
- Sets `payment.isPaid=true`, `paidAt`, payment metadata.
- Recommended for externally-verified payments: always call this endpoint after successful buyer-side verification to ensure lifecycle enters `payment_confirmed`.
- Adds trusted warning when applicable.

### 9.3 `POST /orders/:orderId/lines/decision`

Required scope: `orders:write`

Request example:

```json
{
  "decisions": [
    {
      "lineId": "line-1",
      "acceptedQty": 1,
      "rejectedQty": 1,
      "reason": "Partial availability"
    }
  ]
}
```

Rules:

- order must be in `payment_confirmed`.
- `acceptedQty + rejectedQty` cannot exceed `requestedQty`.
- full reject of a line releases line hold.
- if any line accepted:
  - order transitions to `accepted`
  - active holds are consumed
  - accepted lines are fulfilled into internal checkout flow
- if no lines accepted:
  - order transitions to `rejected`
  - active holds are released

### 9.4 `POST /orders/:orderId/status`

Required scope: `orders:write`

Request:

```json
{
  "status": "processing",
  "reason": "Packed and handed to courier"
}
```

Allowed transitions:

- `placed -> payment_confirmed`
- `payment_confirmed -> accepted | rejected`
- `accepted -> processing`
- `processing -> shipped`
- `shipped -> delivered`

Invalid transitions return conflict (`409`).

### 9.5 Read APIs

- `GET /orders?status=processing` (scope `orders:read`)
- `GET /orders/:orderId` (scope `orders:read`)

### 9.6 Order event payload contract (snapshot)

Marketplace order lifecycle events now publish a full order snapshot in `data.order`.

Example event `data` payload:

```json
{
  "orderId": "65f...",
  "status": "processing",
  "order": {
    "_id": "65f...",
    "orderNumber": "MKT-SEL-123456",
    "partnerOrderRef": "PO-1001",
    "status": "processing",
    "lines": [],
    "totals": {
      "requestedSubtotal": 12000,
      "acceptedSubtotal": 12000,
      "rejectedSubtotal": 0
    }
  }
}
```

This applies to:

- `marketplace.order.placed`
- `marketplace.order.payment_confirmed`
- `marketplace.order.accepted`
- `marketplace.order.rejected`
- `marketplace.order.processing`
- `marketplace.order.shipped`
- `marketplace.order.delivered`
- `marketplace.order.line.updated`

---

## 10) Idempotency (Order Create Reliability)

`POST /orders` uses idempotency middleware when `Idempotency-Key` header is provided.

How it works:

1. Server computes deterministic request hash from method + route + canonical JSON body.
2. First request reserves key in `processing` state.
3. On success/failure completion, response body/code is persisted.
4. Replay with same key + same payload returns stored response.
5. Replay with same key + different payload returns:

```json
{
  "message": "Idempotency key reuse detected with different payload",
  "code": "IDEMPOTENCY_KEY_PAYLOAD_CONFLICT"
}
```

Recommended practice:

- generate UUID per logical order attempt
- reuse the same key for retries/timeouts of that same attempt only

---

## 11) Inventory Holds & Timeouts

- hold duration: **45 minutes**
- sweep interval: **15 minutes** (background job)
- hold statuses: `active`, `released`, `consumed`, `expired`

Operational behavior:

- order creation places holds for pending lines
- line-level reject can release individual holds
- full-order reject releases all active holds
- accepted flow consumes holds as order moves to internal checkout
- stale active holds are marked expired by periodic sweep

---

## 12) Webhooks

### 12.1 Endpoint management (owner session)

- `GET /webhooks/endpoints`
- `POST /webhooks/endpoints`
- `PATCH /webhooks/endpoints/:endpointId`

Create request:

```json
{
  "name": "Partner OMS Webhook",
  "url": "https://partner.example.com/webhooks/marketplace",
  "subscribedEvents": ["marketplace.*"]
}
```

Create response includes one-time secret:

```json
{
  "endpoint": {
    "id": "...",
    "name": "Partner OMS Webhook",
    "url": "https://partner.example.com/webhooks/marketplace",
    "subscribedEvents": ["marketplace.*"],
    "status": "active"
  },
  "secret": "<shown-once>",
  "warning": "Webhook secret is returned once. Store it securely."
}
```

### 12.2 Delivery observability

- `GET /webhooks/deliveries?status=pending|success|failed|dead_letter` (max 200 newest)
- `POST /webhooks/deliveries/:deliveryId/retry`

Manual retry behavior:

- marks delivery `pending`
- sets `nextRetryAt=now`
- queues webhook event for immediate attempt

### 12.3 Event catalog

- `marketplace.listing.updated`
- `marketplace.order.placed`
- `marketplace.order.payment_confirmed`
- `marketplace.order.accepted`
- `marketplace.order.rejected`
- `marketplace.order.processing`
- `marketplace.order.shipped`
- `marketplace.order.delivered`
- `marketplace.order.line.updated`
- `marketplace.webhook.delivery_succeeded`
- `marketplace.webhook.delivery_failed`

For official realtime streaming (WebSocket/SSE), partners also receive business-level updates for:

- `product.*`
- `product_group.*`
- `inventory.*`
- `discount.*`

### 12.4 Webhook request signature

Outgoing headers:

- `x-marketplace-event-type`
- `x-marketplace-event-id`
- `x-marketplace-delivery-id`
- `x-marketplace-event-timestamp`
- `x-correlation-id` (optional)
- `x-marketplace-signature`
- `x-provider-signature` (compatibility alias)

Signature generation (`x-marketplace-signature`):

- `t=<unix_seconds>,v1=<hex>`
- signed payload string: `<t>.<raw_json_payload>`
- `v1 = HMAC_SHA256(webhook_secret, <signed_payload_string>)`
- during overlap rotation windows, header may include two `v1` values (current + next secret)

Receiver guidance:

- verify signature using constant-time compare
- dedupe by `x-marketplace-delivery-id` or `x-marketplace-event-id`
- return fast `2xx` responses

### 12.5 Retry policy

- max attempts: `5`
- retry delay schedule (minutes): `1, 5, 15, 30, 60`
- non-2xx or network error triggers retry (until exhausted)
- exhausted deliveries are moved to `dead_letter`
- webhook fanout is non-blocking (order flow does not wait for webhook success)

### 12.6 Webhook v2 order contract (additive)

Webhook v2 is emitted additively (legacy payload can run in parallel during migration).

Required order event types:

- `marketplace.order.payment_confirmed`
- `marketplace.order.accepted`
- `marketplace.order.rejected`
- `marketplace.order.processing`
- `marketplace.order.shipped`
- `marketplace.order.delivered`
- `marketplace.order.line.updated`

Envelope fields:

- `eventId` (stable UUID reused across retries)
- `deliveryId`
- `correlationId`
- `eventType`
- `schemaVersion` (`2.0.0`)
- `occurredAt`
- `order` (latest full snapshot)
- `lines[]` (latest full line snapshot set)

Each `lines[]` item includes:

- `lineId`, `productId`, `requestedQty`, `acceptedQty`, `rejectedQty`
- `decisionStatus`, `decisionReason`
- `variantId`, `parentGroupId`, `groupName`
- `variantImage`, `groupImage`, `selectedImage` (fallback-ready)

### 12.7 Partner M2M webhook registration

Partner-authenticated registration APIs:

- `PUT /webhooks/provider-endpoint` (idempotent upsert by `endpointIdentity + environment`)
- `POST /webhooks/provider-endpoint/:providerEndpointId/rotate-secret`

Upsert response includes `providerEndpointId` for future updates/rotations.

Secret rotation supports overlap windows where signatures are emitted so receivers can accept both current and next secret values before cutover.

### 12.8 Feature flags

- `MARKETPLACE_WEBHOOK_V2_ENABLED` (default `true`)
- `MARKETPLACE_WEBHOOK_LEGACY_ENABLED` (default `true`)
- `MARKETPLACE_WEBHOOK_DUAL_RUN` (default `false`)

### 12.9 Delivery event notes

- `marketplace.webhook.delivery_succeeded` and `marketplace.webhook.delivery_failed` are emitted for observability.
- If the original event is order-related, delivery events include `data.orderId` and `data.order` snapshot context when available.

---

## 13) Rate Limiting

- Applied per credential to protected partner requests and `/auth/token`.
- Limit source: credential `rateLimit.perMinute`, default `120`.
- Current implementation is in-memory, minute-bucketed, per server instance.

---

## 13.1 Official Realtime Streaming (WebSocket/SSE)

Partners can consume real-time updates from Sell Square over WebSocket or SSE using partner access tokens.

### WebSocket

- Endpoint: `/ws`
- Auth: either
  - `Authorization: Bearer <accessToken>` during handshake, or
  - `?token=<accessToken>` query fallback

### SSE

- Endpoint: `/api/realtime/events`
- Auth: `Authorization: Bearer <accessToken>` or `?token=<accessToken>`

### Partner stream scope and filtering

For partner-authenticated realtime sessions, server-side filtering allows only:

- `marketplace.*`
- `product.*`
- `product_group.*`
- `inventory.*`
- `discount.*`

This ensures partners receive order, listing, and business-level inventory/discount changes without internal-only event families.

Rate-limit response:

```json
{
  "message": "Rate limit exceeded for this API credential",
  "limit": 120
}
```

---

## 14) Error Guide

Typical status codes:

- `400` validation/input errors
- `401` missing/invalid auth, invalid signature, expired/revoked token
- `403` missing scope or allowlist domain failure
- `404` resource not found
- `409` state conflict (replay, invalid transition, idempotency conflict)
- `429` rate limit exceeded

Common messages/codes:

- `Missing API key`
- `Missing API secret`
- `Invalid API key/secret`
- `Missing signed request headers`
- `Request timestamp is outside allowed skew`
- `Replay request detected`
- `Missing required scopes`
- `Request domain is not allowlisted for this credential`
- `INVALID_LISTING_PRODUCT`
- `Line decisions require payment_confirmed status`
- `IDEMPOTENCY_KEY_PAYLOAD_CONFLICT`
- `Invalid marketplace order transition: <from> -> <to>`

---

## 15) Production Readiness Checklist

- [ ] Create least-privilege scopes per integration.
- [ ] Store `keyId`, API secret, webhook secret in a secrets manager.
- [ ] Implement request signing exactly (method/path/body hash/timestamp/nonce).
- [ ] Ensure partner runtime domain(s) are in `allowlistedDomains`.
- [ ] Add robust token automation with refresh rotation persistence.
- [ ] Send `Idempotency-Key` on every order creation call.
- [ ] Handle `401` with single refresh-and-retry strategy.
- [ ] Validate webhook signatures with constant-time compare.
- [ ] Dedupe webhook processing by delivery/event IDs.
- [ ] Monitor for `401`, `403`, `409`, `429`, and webhook `failed` deliveries.

---

## 16) Quickstart (End-to-End)

1. Owner creates credential (`/auth/keys`) and securely shares `keyId` + `secret` with partner.
2. Partner signs and sends `POST /auth/token`.
3. Partner stores returned tokens; starts proactive refresh loop.
4. Partner calls:
   - `GET /listings` to sync offer catalog
   - `POST /orders` to place orders
   - `POST /orders/:orderId/payment-confirm` when payment settles
   - `POST /orders/:orderId/lines/decision` for line acceptance/rejection
   - `POST /orders/:orderId/status` for fulfillment progression
5. Owner configures webhook endpoint and secret.
6. Partner verifies webhook signatures and processes events idempotently.

---

## 17) Environment Notes

Relevant environment variables used by this integration:

- `PUBLIC_PARTNER_JWT_SECRET` (preferred access-token signing secret)
- fallback: `JWT_SECRET`
- `MARKETPLACE_SECRET_ENCRYPTION_KEY` (secret encryption key)
- fallback: `JWT_SECRET`

Set explicit, strong values in production. Do not rely on fallbacks.
