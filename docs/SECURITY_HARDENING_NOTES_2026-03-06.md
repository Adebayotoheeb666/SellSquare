# Security Hardening Notes — 2026-03-06

This note captures the targeted production hardening pass for realtime/auth/marketplace race conditions.

## Realtime (SSE)

- Enforced user-scoped filtering parity with WebSocket for cart events (`cart.*`/`CART*`), using event user identity matching.
- Hardened SSE CORS behavior:
  - Removed permissive origin reflection.
  - Added explicit allowlist (`localhost:3000`, `localhost:3001`, Render production origin, plus env-configurable additions via `ALLOWED_ORIGINS`/`CORS_ALLOWED_ORIGINS`).
  - Added `Vary: Origin` and blocked disallowed origins with `403`.

## Public token refresh/revoke hardening

- Added public rate limiting to `/auth/token/refresh` and `/auth/token/revoke`.
- Improved fallback rate limiting when no credential is present (IP + route scoped buckets).
- Implemented atomic single-use refresh rotation via conditional `findOneAndUpdate` claim.
- Reduced token enumeration signal on revoke by returning success-shaped response even when token is already absent/revoked.
- Added unique index for `refreshTokenHash`.

## Marketplace order oversell race mitigation

- Added atomic hold-capacity reservation tied to product-level hold counters (`activeMarketplaceHoldQty`).
- Hold creation now reserves capacity atomically and fails closed with explicit conflict code on insufficient capacity.
- Order creation now treats hold reservation as authoritative and safely downgrades affected lines to `out_of_stock` when a concurrent reservation wins.

## Webhook dispatch duplicate race mitigation

- Added per-delivery dispatch lease/claim fields and indexes.
- Dispatch now requires successful claim before send (`dispatchWebhookDeliveryById`, retry sweep, immediate queue path).
- Manual retry clears lease state before re-queue.
- Success/failure transitions clear lease ownership.

## Idempotency processing-state behavior

- `reserveIdempotencyKey` now distinguishes in-flight processing (`isProcessing`) from completed replay.
- Middleware now returns explicit conflict response (`IDEMPOTENCY_KEY_IN_PROGRESS`) for in-flight key reuse.

## Event dedupe (middleware + change stream)

- Added short-window cross-source semantic dedupe guard in EventBus.
- Middleware and change-stream emissions now include aligned semantic dedupe keys to suppress duplicate semantic updates.

## Regression tests added/updated

- SSE origin hardening + user-scoped cart filtering.
- EventBus middleware/change-stream semantic dedupe.
- Public fallback IP throttling.
- Refresh rotation concurrency (single success).
- Marketplace order reservation race fallback (`out_of_stock` downgrade).
- Webhook dispatch claim semantics (single claimant).
- Idempotency processing-state replay behavior.
