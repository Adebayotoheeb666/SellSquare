# Public Marketplace Listings Performance Rollout

## Scope

This rollout applies only to `/api/public/v1/marketplace/listings` and shared marketplace listing projection/discount resolution code paths.

## Index rollout (safe)

Indexes were added in schema definitions with `{ background: true }` to avoid foreground blocking where supported.

### Added indexes

- `Products`:
  - `idx_product_listed_single_business`: `{ business: 1, listProduct: 1, productIsaGroup: 1, updatedAt: -1 }`
  - `idx_product_listed_variants_by_group`: `{ business: 1, productIsaGroup: 1, itemGroup: 1, listProduct: 1, updatedAt: -1 }`
- `productGroup`:
  - `idx_group_listed_by_business`: `{ business: 1, listGroup: 1, updatedAt: -1 }`
- `Discount`:
  - `idx_discount_active_window`: `{ business: 1, isActive: 1, status: 1, startDate: 1, expirationDate: 1, createdAt: -1 }`

### Pre-flight

1. Confirm disk headroom and replica set health.
2. Confirm MongoDB version behavior for background index builds.
3. Run `db.currentOp()` checks during off-peak windows.

### Rollout order

1. Deploy code to staging.
2. Allow app startup index sync to complete.
3. Validate with `db.collection.getIndexes()` and query plans (`explain("executionStats")`).
4. Canary production on a subset of traffic.
5. Full production rollout.

## Rollback plan

### Triggers

- Sustained p95/p99 regressions for listings endpoint.
- Elevated Mongo CPU/lock contention during rollout.
- Any contract regression observed by existing NINO integration.

### Actions

1. Disable canary and roll app back to previous release.
2. Keep indexes in place unless confirmed as direct cause.
3. If needed, drop newly added indexes one at a time during low traffic:
   - `db.products.dropIndex("idx_product_listed_single_business")`
   - `db.products.dropIndex("idx_product_listed_variants_by_group")`
   - `db.productgroups.dropIndex("idx_group_listed_by_business")`
   - `db.discounts.dropIndex("idx_discount_active_window")`
4. Re-run baseline latency/query count checks.

## Validation checks

- Endpoint returns unchanged listing contract fields plus optional `pagination` when requested.
- Query count profile remains constant with large payloads (no per-item discount query behavior).
- Timing logs include phase durations and total request latency.
