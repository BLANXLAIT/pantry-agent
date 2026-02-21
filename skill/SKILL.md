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
5. Cart and profile commands require Kroger login. Use the agent-managed OAuth flow below.
6. Always confirm with the user before adding items to their cart.
7. Show prices and stock availability when displaying products.

## Authentication flow (agent-managed OAuth)

When a cart or profile operation fails because the user is not authenticated, follow these steps:

1. Call `kroger_start_auth` — this starts a local callback server and returns the Kroger authorization URL.
2. Present the URL to the user and ask them to open it in their browser.
3. The user completes the Kroger login in their browser; the callback server captures the token automatically.
4. Wait for the user to confirm that login is complete.
5. Retry the original cart or profile operation.

**Do not** attempt to open the URL yourself. Present it to the user for them to open.

You can also use the `kroger-oauth` prompt to get step-by-step guidance for this flow.

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

## MCP tool reference

| Tool | Description | Auth required |
|------|-------------|---------------|
| `find_stores` | Find Kroger-owned stores near a ZIP code | No |
| `get_store` | Get store details including hours and departments | No |
| `search_products` | Search for products by name, brand, or description | No |
| `get_product` | Get detailed product info (price, stock, fulfillment) | No |
| `add_to_cart` | Add items to the user's Kroger cart | Yes |
| `get_profile` | Get the authenticated user's profile | Yes |
| `kroger_start_auth` | Start browser-based OAuth; returns authorization URL | — |

## Notes

- All data commands output JSON to stdout.
- The cart is account-level, not store-specific. Items go to the user's single Kroger cart regardless of which store was searched.
- The user picks their fulfillment store on kroger.com or the Kroger app.
- Tokens are stored locally at `~/.pantry-agent/tokens.json`.
