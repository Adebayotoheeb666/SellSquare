# RFC: Product Group Variant ID Stability and Non-Destructive Update Flow

- Status: Proposed
- Owner: Inventory/Marketplace team
- Date: 2026-03-04
- Scope: Backend API, data model, migration, realtime event emissions, discount integrity

## 1) Problem Statement

Today, updating a product group deletes all variant documents in the single product model and recreates them.

Current behavior (controller path):
- Endpoint: PATCH /api/products/update-product-group/:id
- File: controllers/productController.js
- Existing logic:
  1. Load existing variants by itemGroup
  2. deleteMany(itemGroup)
  3. Recreate all variants with new _id values

Why this is harmful:
- Discount targeting stores direct variant product IDs in appliedProducts and appliedGroupItems.
- Marketplace order/listing contracts use listingId + variantId and enforce variant-group consistency.
- Cart items store variant product id.
- Recreating variants changes IDs and invalidates references.

## 2) Goals and Non-Goals

### Goals
- Preserve variant _id for matched variants during group edits.
- Add stable variantKey for every group variant and persist it in ProductGroup and Product (single product representation of group variants).
- Delete only unmatched variants (explicitly removed by user).
- Before deletion/detach side effects, return impact summary and require explicit user confirmation to continue.
- Automatically run a discount repair process for historical broken references.
- Keep event-driven architecture behavior consistent and cache-safe.

### Non-Goals
- No UI redesign in this RFC.
- No change to public marketplace order payload shape.
- No backend pagination/search redesign.

## 3) Decisions Confirmed

1. Variant identity strategy:
   - New variantKey field (preferred canonical identity for group variants).
   - For old groups without variantKey, match using variant information from each variant record and incoming values.
   - Any incoming variant with no match creates a new variant.
   - Any existing variant with no incoming match is removed.

2. Deletion impact confirmation:
   - API must return conflict/impact summary and require explicit confirmation to proceed with detach/delete side effects.

3. Data model extension:
   - Add variantKey in ProductGroup representation and Product variant representation.

4. Discount repair:
   - Run automatically (idempotent) after deployment/backfill.

## 4) Data Model Changes

### 4.1 Product model (group variants only)
Add fields:
- variantKey: String, indexed (compound with business + itemGroup)
- variantLabel: String (optional denormalized display label)

Constraints:
- Unique index (business, itemGroup, variantKey) sparse.
- For non-group products, variantKey remains null/undefined.

### 4.2 ProductGroup model
Add field:
- variantMap: [{
    variantKey: String,
    combination: String,
    sku: String,
    indexHint: Number,
    lastKnownProductId: ObjectId
  }]

Notes:
- variantMap is an identity ledger for deterministic matching across edits.
- combinations array remains for backward compatibility and UI display.

## 5) Endpoint-Level Contract Changes

## 5.1 Update group endpoint
- Endpoint: PATCH /api/products/update-product-group/:id
- Add optional request flags:
  - confirmDetachConflicts: boolean (default false)
  - previewOnly: boolean (default false)

### Request
Current payload remains valid. New optional flags above are accepted.

### Response behavior
- 200 OK:
  - Update applied.
  - Includes summary:
    - matchedCount
    - createdCount
    - removedCount
    - detachedDiscountRefsCount
    - detachedCartRefsCount
- 409 CONFLICT (when destructive impacts detected and not confirmed):
  - message: human-readable impact summary
  - code: GROUP_UPDATE_REQUIRES_CONFIRMATION
  - impact:
    - toRemoveVariantIds
    - discountsAffected: [{ discountId, discountName, affectedVariantIds }]
    - cartsAffectedCount
    - marketplaceRiskCount
  - nextAction:
    - resend same payload with confirmDetachConflicts=true

### Pseudoflow

1. Parse incoming group update payload.
2. Build incoming variant candidates list with deterministic normalized identity fields:
   - combination
   - sku
   - attributes/options-derived canonical string
3. Load existing Product variants for itemGroup.
4. Match strategy:
   - Phase A: variantKey exact match (new groups and already migrated groups)
   - Phase B: fallback matching for legacy groups (scored match by combination + sku + normalized signature)
5. Produce diff:
   - matched (update in place)
   - toCreate
   - toRemove
6. Evaluate side effects for toRemove:
   - discounts referencing toRemove variant ids
   - carts referencing toRemove ids
   - other direct id references as needed
7. If impacts exist and !confirmDetachConflicts:
   - return 409 with impact payload (no writes)
8. Else execute transaction:
   - update ProductGroup fields + variantMap
   - update matched Product docs in place (preserve _id)
   - create Product docs for toCreate (generate variantKey)
   - remove Product docs for toRemove
   - auto detach references in discounts/carts for removed ids
9. Emit events:
   - PRODUCT_UPDATED for matched
   - PRODUCT_CREATED for created
   - PRODUCT_DELETED for removed
   - PRODUCT_GROUP_UPDATED once
10. Return 200 with operation summary.

## 5.2 Create group endpoint
- Endpoint: POST /api/products/multiple

Changes:
- Generate variantKey for each newly created variant.
- Persist variantKey on Product docs and in ProductGroup.variantMap.

## 6) Matching Algorithm (Legacy + New)

### 6.1 Canonical normalized signature
For each variant candidate (incoming and existing), compute:
- normalizedCombination = lowercase(trim(combination))
- normalizedSku = lowercase(trim(sku))
- normalizedAttributesSignature = stable serialization of option values in order

### 6.2 Match priority
1. variantKey exact (if present both sides)
2. normalizedCombination exact
3. normalizedSku exact (only if unique within group)
4. weighted composite best-match (combination + sku + attribute signature) above threshold

Collision handling:
- If ambiguous matches remain, treat as unmatched and require user confirmation path (with impact message).

## 7) Auto-Detach and User Confirmation Rules

When variants are removed:
- Discounts:
  - Remove removed variant IDs from appliedProducts and appliedGroupItems.
  - If a discount becomes target-empty after detach, mark status=draft and return warning in response.
- Carts:
  - Pull removed variant IDs from cart items.
- Response warnings:
  - return detached entity counts and IDs (capped list + totals).

User-facing flow:
- First save attempt may return 409 with impact summary.
- Client shows message and asks user to continue.
- Second save sends confirmDetachConflicts=true to proceed.

## 8) Migration and Automatic Repair Plan

## 8.1 Migration A: variantKey backfill
- Script/job:
  1. Iterate all product groups by business.
  2. Load variants under each itemGroup.
  3. Generate variantKey for each variant lacking it.
  4. Write Product.variantKey and ProductGroup.variantMap.
- Idempotent and resumable.

## 8.2 Migration B: discount reference repair (automatic)
- Trigger automatically after Migration A and also on app startup until completion marker exists.
- For each discount:
  1. Validate appliedProducts/appliedGroupItems existence.
  2. For missing variant IDs, attempt remap by:
     - variantKey (if recoverable from historical link)
     - fallback: group + combination/sku signature from ProductGroup.variantMap
  3. If remap found, replace IDs.
  4. If remap not found, detach ID and append warning log.
- Persist migration marker per business to avoid repeat heavy runs.

## 8.3 Safety controls
- Dry-run mode internally first, then apply mode automatically in same deployment window.
- Metrics and logs:
  - repairedCount
  - detachedCount
  - unresolvedCount
  - businessesCompleted

## 9) Realtime/Event Implications

Keep event-driven architecture intact:
- No broad delete/recreate burst for all variants on every group update.
- Emit precise product events for changed docs only.
- Continue emitting PRODUCT_GROUP_UPDATED for group metadata changes.

Expected frontend impact:
- Product cache receives stable IDs for matched variants.
- Discount/detail screens continue resolving selected group items.
- Marketplace listing variantId remains stable unless variant is intentionally removed.

## 10) Backward Compatibility

- Existing request payloads remain valid.
- New response shape for 409 confirmation required path is additive.
- Legacy groups without variantKey are supported through fallback matching and progressive backfill.

## 11) Risks and Mitigations

1. Ambiguous legacy matching
- Mitigation: conservative matching + 409 confirmation path + explicit impact summary.

2. Partial writes across models
- Mitigation: use Mongo transaction/session for update group flow.

3. Discounts accidentally emptied by detach
- Mitigation: auto mark draft + warning payload + activity log.

4. Performance on large tenants during backfill
- Mitigation: batched processing, per-business cursor, resumable checkpoints.

## 12) Test Plan Mapped to Current Suite

### 12.1 Extend existing test files

1. __tests__/controllers/productController.test.js
- Add new describe block for updateProductGroup:
  - preserves _id for matched variants
  - creates new docs only for added variants
  - deletes only removed variants
  - returns 409 with impact when removed variants are referenced and confirm flag missing
  - proceeds and detaches references when confirmDetachConflicts=true

2. __tests__/marketplace/discountResolver.test.js
- Add cases proving discount applies after group edit when matched variants keep same IDs.
- Add detach behavior assertions for removed variants (post-update state helpers).

3. __tests__/marketplace/marketplaceLineResolver.test.js
- Add case: unchanged variant remains resolvable by same listingId+variantId after group update.
- Add case: removed variant returns LISTING_VARIANT_MISMATCH.

4. __tests__/integration/marketplace.listings.test.js
- Add scenario where group edit modifies metadata but preserved variant IDs remain in listing payload.
- Add scenario where removed variant disappears from listing variants.

5. __tests__/integration/marketplace.orders.test.js
- Add scenario: existing listingId+variantId order still accepted after non-destructive group edit.
- Add scenario: removed variant order rejected with expected code.

6. __tests__/marketplace/checkoutFulfillmentService.test.js
- Add assertion that group history and variant history continue to align after variantKey-based matching updates.

### 12.2 New test files

1. __tests__/controllers/productController.updateGroup.identity.test.js
- Focused matching algorithm unit/integration-style controller tests.

2. __tests__/services/discountRepair.job.test.js
- Automatic repair/remap/detach idempotency and metrics tests.

3. __tests__/services/variantKeyBackfill.job.test.js
- Backfill correctness and resumability tests.

## 13) Rollout Plan

Phase 0 (pre-deploy)
- Add schema fields and indexes (backward compatible).

Phase 1
- Deploy code paths with feature flag GROUP_UPDATE_NON_DESTRUCTIVE=false.
- Run backfill job and automatic discount repair in observe mode.

Phase 2
- Enable GROUP_UPDATE_NON_DESTRUCTIVE for internal/pilot businesses.
- Monitor:
  - 409 confirmation frequency
  - detach counts
  - order resolver mismatch rate

Phase 3
- Enable for all businesses.
- Keep repair job active until all businesses marked complete.

Phase 4
- Remove legacy delete/recreate path.

## 14) Operational Metrics

- groupUpdate.matched
- groupUpdate.created
- groupUpdate.removed
- groupUpdate.requiresConfirmation
- groupUpdate.autoDetach.discountRefs
- groupUpdate.autoDetach.cartRefs
- discountRepair.repaired
- discountRepair.detached
- discountRepair.unresolved

## 15) Open Implementation Notes

- Use stable deterministic variantKey generation for new variants (uuid/ulid preferred; never derived solely from mutable names).
- Always write variantKey to both Product and ProductGroup.variantMap during create and update.
- Keep activity logs explicit when detach occurs.

## 16) Acceptance Criteria

- Editing a group with unchanged variants no longer changes variant IDs.
- Discounts/listings/orders for unchanged variants remain valid after edits.
- Removed variants are the only IDs detached/deleted.
- User receives confirmation-required message when removal impacts existing references.
- Automatic discount repair completes and reports unresolved remnants.
- Realtime cache stays consistent without full-group product cache invalidation.
