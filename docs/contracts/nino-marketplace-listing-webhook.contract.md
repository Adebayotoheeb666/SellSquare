# NINO Marketplace Listing Webhook Contract

## Event Name (stable)

`marketplace.listing.updated`

## Envelope

Listing webhooks are delivered inside the existing event envelope:

- `id`
- `type`
- `version`
- `timestamp`
- `data`
- `metadata`
- `signature`

Delivery headers remain stable:

- `x-marketplace-event-type`
- `x-marketplace-event-id`
- `x-marketplace-delivery-id`
- `x-marketplace-event-timestamp`
- `x-correlation-id`
- `x-marketplace-signature`
- `x-marketplace-signature-v1`
- `x-marketplace-schema-version`

## `data` shape

- `sourceEventType`: source mutation event that triggered the update
- `sourceEventId`: source event id
- `updatedAt`: ISO timestamp
- `listings[]`: canonical listing snapshots

Each listing includes deterministic identity and canonical pricing fields.

## Example: Single Listing Update

```json
{
  "type": "marketplace.listing.updated",
  "data": {
    "sourceEventType": "discount.updated",
    "sourceEventId": "evt_abc123",
    "updatedAt": "2026-03-04T12:00:00.000Z",
    "listings": [
      {
        "listingId": "65f5d3f8f1c2a8a2d09d1111",
        "listingType": "single",
        "identity": {
          "deterministicId": "single:65f5d3f8f1c2a8a2d09d1111",
          "listingId": "65f5d3f8f1c2a8a2d09d1111",
          "productId": "65f5d3f8f1c2a8a2d09d1111",
          "listingType": "single"
        },
        "listed": true,
        "updatedAt": "2026-03-04T11:59:58.000Z",
        "stock": {
          "quantity": 12,
          "state": "in_stock"
        },
        "pricing": {
          "basePrice": 15000,
          "effectivePrice": 12000,
          "discount": {
            "id": "65f5d3f8f1c2a8a2d09d9999",
            "name": "March Promo",
            "valueType": "percentage",
            "amount": 20
          }
        }
      }
    ]
  }
}
```

## Example: Group Listing Update

```json
{
  "type": "marketplace.listing.updated",
  "data": {
    "sourceEventType": "checkout.completed",
    "sourceEventId": "evt_xyz456",
    "updatedAt": "2026-03-04T12:05:00.000Z",
    "listings": [
      {
        "listingId": "65f5d3f8f1c2a8a2d09d2222",
        "listingType": "group",
        "identity": {
          "deterministicId": "group:65f5d3f8f1c2a8a2d09d2222",
          "listingId": "65f5d3f8f1c2a8a2d09d2222",
          "groupId": "65f5d3f8f1c2a8a2d09d2222",
          "listingType": "group"
        },
        "listed": true,
        "updatedAt": "2026-03-04T12:04:59.000Z",
        "variants": [
          {
            "variantId": "65f5d3f8f1c2a8a2d09d3333",
            "listingId": "65f5d3f8f1c2a8a2d09d2222",
            "identity": {
              "deterministicId": "group:65f5d3f8f1c2a8a2d09d2222:variant:65f5d3f8f1c2a8a2d09d3333",
              "listingId": "65f5d3f8f1c2a8a2d09d2222",
              "groupId": "65f5d3f8f1c2a8a2d09d2222",
              "variantId": "65f5d3f8f1c2a8a2d09d3333",
              "listingType": "group_variant"
            },
            "listed": true,
            "stock": {
              "quantity": 3,
              "state": "in_stock"
            },
            "pricing": {
              "basePrice": 22000,
              "effectivePrice": 19800,
              "discount": {
                "id": "65f5d3f8f1c2a8a2d09d8888",
                "name": "Variant Promo",
                "valueType": "percentage",
                "amount": 10
              }
            }
          }
        ]
      }
    ]
  }
}
```

## Migration Notes for Consumers

1. Continue routing by `type === marketplace.listing.updated`.
2. Use `listings[].identity.deterministicId` as idempotency key for listing snapshots.
3. Prefer `pricing.basePrice`, `pricing.effectivePrice`, `pricing.discount` over any legacy price fields.
4. For grouped listings, consume variant price updates from `listings[].variants[]`.
5. Honor `listed: false` or `removed: true` as de-list/remove actions.
