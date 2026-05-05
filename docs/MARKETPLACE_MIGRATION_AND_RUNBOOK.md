# Marketplace Migration Notes & Runbook

## Migration Notes

New collections introduced:
- `PublicApiCredential`
- `PublicRefreshSession`
- `PublicRequestNonce`
- `PublicIdempotencyKey`
- `MarketplaceOrder`
- `InventoryHold`
- `MarketplaceWebhookEndpoint`
- `MarketplaceWebhookDelivery`

No destructive changes were made to existing collections/routes.

## Feature Flags (recommended)

Use env flags during rollout:
- `MARKETPLACE_PUBLIC_API_ENABLED`
- `MARKETPLACE_WEBHOOKS_ENABLED`
- `MARKETPLACE_INTERNAL_UI_ENABLED`
- `PUBLIC_PARTNER_JWT_SECRET`
- `MARKETPLACE_SECRET_ENCRYPTION_KEY`

## Staged Deployment Plan

1. **Stage A – Dark launch**
   - Deploy backend models/services/routes.
   - Keep partner credentials unissued.
   - Monitor DB write paths and job behavior.

2. **Stage B – Internal-only enablement**
   - Enable internal orders UI route and bootstrap cache hydration.
   - Verify realtime updates and order status transitions.

3. **Stage C – Pilot partners**
   - Issue credentials to 1–2 pilot businesses.
   - Enable signed token issue + domain allowlist.
   - Monitor idempotency and hold expiration behavior.

4. **Stage D – Webhook activation**
   - Register webhook endpoints.
   - Validate delivery retries and non-blocking order flow.

5. **Stage E – Full release**
   - Broaden credential issuance.
   - Tighten alert thresholds and SLO tracking.

## Variant Update Rollout Notes

- Phase 4 is active: stable-id non-destructive group updates are now the only supported update mode.
- Legacy destructive delete/recreate fallback is removed from runtime path.

## Monitoring Checklist

- **Orders**
  - new `MarketplaceOrder` creation rate
  - status transition errors
  - partial accept/reject ratio

- **Inventory Holds**
  - active holds count
  - expired holds count per sweep
  - release latency after rejection

- **Auth**
  - token issue success/failure
  - refresh rotation failures
  - domain allowlist rejections
  - signature/replay failures

- **Webhooks**
  - pending/success/failed delivery counts
  - retries exhausted
  - median delivery latency

## Rollback Strategy

1. Disable `MARKETPLACE_PUBLIC_API_ENABLED`.
2. Stop issuing new credentials and revoke pilot credentials.
3. Keep data intact; no schema rollback required.
4. Preserve `MarketplaceOrder`/delivery logs for postmortem.

## Incident Playbook

### Symptom: webhook failures spike
- Confirm endpoint status and TLS/host resolution.
- Inspect `MarketplaceWebhookDelivery` failures.
- Retry specific failed deliveries via admin endpoint.

### Symptom: holds not releasing
- Trigger `POST /api/public/v1/marketplace/orders/ops/hold-expiry-sweep` (internal).
- Verify `InventoryHold` status transitions.
- Check job startup logs and interval execution.

### Symptom: invalid partner auth bursts
- Validate partner clock skew.
- Validate domain allowlist entries.
- Validate signature header generation format.
