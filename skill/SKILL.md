---
name: pantry-agent
description: Grocery shopping assistant for Kroger-owned stores. Find nearby stores, search products with pricing, and add items to your cart. Works with Kroger, Ralphs, Fred Meyer, King Soopers, Harris Teeter, Food 4 Less, Fry's, Smith's, and more.
user-invocable: true
---

# Pantry Agent

Grocery shopping assistant powered by the Kroger API. Supports all Kroger-owned banners.

## Workflow

1. Ask the user for their ZIP code if not already known.
2. Find the nearest store. The response includes the chain name (Kroger, Ralphs, etc.).
3. Use the `locationId` from the store result for all subsequent product searches.
4. Store, search, and product commands work without authentication.
5. Cart commands require Kroger login. If a cart command fails with an auth error, tell the user to run `npx @blanxlait/pantry-agent auth` in their own terminal (not via tool use). Auth must be run interactively — it opens a browser and listens for a callback. Once they confirm login is complete, retry the cart command.
6. Always confirm with the user before adding items to their cart.
7. Show prices and stock availability when displaying products.

## Finding stores

```bash
npx @blanxlait/pantry-agent stores <zip>
npx @blanxlait/pantry-agent stores <zip> --limit 10
```

## Getting store details

```bash
npx @blanxlait/pantry-agent store <locationId>
```

## Searching products

```bash
npx @blanxlait/pantry-agent search "<term>" --store <locationId>
npx @blanxlait/pantry-agent search "<term>" --store <locationId> --limit 20
npx @blanxlait/pantry-agent search "<term>" --store <locationId> --brand "Kroger"
```

## Getting product details

```bash
npx @blanxlait/pantry-agent product <productId> --store <locationId>
```

## Adding to cart (requires auth)

```bash
npx @blanxlait/pantry-agent cart add <upc> --qty 2 --modality PICKUP
```

**Important:** Do NOT run the auth command yourself. If the user isn't authenticated, tell them to run this in their terminal:

```
npx @blanxlait/pantry-agent auth
```

Auth requires an interactive terminal — it opens a browser and waits for a callback. Wait for the user to confirm login succeeded before retrying the cart command.

## Command reference

| Command | Description | Auth required |
|---------|-------------|---------------|
| `stores <zip>` | Find Kroger-owned stores near a ZIP code | No |
| `store <locationId>` | Get store details including hours and departments | No |
| `search "<term>" --store <id>` | Search for products by name, brand, or description | No |
| `product <id> --store <id>` | Get detailed product info (price, stock, fulfillment) | No |
| `cart add <upc>` | Add items to the user's Kroger cart | Yes |
| `auth` | Authenticate with Kroger (opens browser) | — |
| `auth --status` | Check authentication status | — |

## Notes

- All data commands output JSON to stdout.
- The cart is account-level, not store-specific. Items go to the user's single Kroger cart regardless of which store was searched.
- The user picks their fulfillment store on kroger.com or the Kroger app.
