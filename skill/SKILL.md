---
name: pantry-agent
description: Grocery shopping assistant for Kroger-owned stores. Find nearby stores, search products with pricing, and add items to your cart. Works with Kroger, Ralphs, Fred Meyer, King Soopers, Harris Teeter, Food 4 Less, Fry's, Smith's, and more.
user-invocable: true
---

# Pantry Agent

Grocery shopping assistant powered by the Kroger API. Supports all Kroger-owned banners.

## Workflow

1. Ask the user for their ZIP code if not already known.
2. Find the nearest store using `find_stores`. The response includes the chain name (Kroger, Ralphs, etc.) and the `locationId`.
3. Use the `locationId` from the store result for all subsequent product searches.
4. Store, search, and product commands work without authentication.
5. Use `preview_cart` with the `locationId` to validate item pricing and availability before adding to cart. No authentication required.
6. Before adding to cart, call `check_auth_status` to determine if the user is authenticated.
7. If not authenticated, call `kroger_start_auth` to get the authorization URL and present it to the user.
8. After the user completes login, retry the cart or profile operation.
9. Always confirm with the user before adding items to their cart.
10. Show prices and stock availability when displaying products.

## Authentication flow (agent-managed OAuth)

Authentication is decoupled from cart operations — `add_to_cart` and `get_profile` return an `AUTH_REQUIRED` error without opening a browser. Follow these steps when authentication is needed:

1. Call `check_auth_status` to see if the user is already authenticated (avoids unnecessary auth prompts).
2. If not authenticated, call `kroger_start_auth` — this starts a local callback server and returns the Kroger authorization URL.
3. Present the URL to the user and ask them to open it in their browser.
4. The user completes the Kroger login in their browser; the callback server captures the token automatically.
5. Wait for the user to confirm that login is complete.
6. Retry the original cart or profile operation.

**Do not** attempt to open the URL yourself. Present it to the user for them to open.

You can also use the `kroger-oauth` prompt to get step-by-step guidance for this flow.

## Example agentic flows

### Shopping flow (search → preview → add)
```
1. find_stores(zipCode: "94102")          → get locationId
2. search_products(term: "milk", locationId: ...)  → pick product UPC
3. preview_cart(items: [{upc, qty}], locationId: ...) → verify price/stock
4. check_auth_status()                    → verify authentication
5. [if not auth] kroger_start_auth()      → user logs in
6. add_to_cart(items: [{upc, qty}])       → confirm to user
```

### Re-order flow (authenticated user)
```
1. check_auth_status()                    → already authenticated
2. find_stores(zipCode: "...")            → get locationId
3. search_products(term: "eggs", ...)    → find item
4. preview_cart(items: [...], locationId: ...) → verify availability
5. add_to_cart(items: [...])             → add items
```

### Background/headless flow
All tools return structured JSON responses directly — no browser interaction is triggered automatically. The agent controls when to present auth URLs to users by explicitly calling `kroger_start_auth`.

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
| `search_products` | Search for products by name, brand, or description. Returns price, stock, fulfillment, size, and categories. | No |
| `get_product` | Get detailed product info (price, stock, fulfillment) | No |
| `preview_cart` | Preview items before adding: shows pricing, availability, and estimated total. Useful for validation before add_to_cart. | No |
| `check_auth_status` | Check if the user is authenticated without triggering an OAuth flow | No |
| `add_to_cart` | Add items to the user's Kroger cart | Yes |
| `get_profile` | Get the authenticated user's profile | Yes |
| `kroger_start_auth` | Start browser-based OAuth; returns authorization URL for user to open | — |

## Error handling

Agent-driven actions return structured errors for common failure modes:

| Error type | Description | Resolution |
|------------|-------------|------------|
| `AUTH_REQUIRED` | User is not authenticated | Call `kroger_start_auth`, present URL to user |
| Out of stock | `availability: "out_of_stock"` in product results | Show alternatives from `search_products` |
| Unknown stock | `availability: "unknown"` in product results | Inform user; item may still be available |
| Product not found | `error` field in `preview_cart` item | Verify UPC or search for alternative |
| Fulfillment unavailable | `fulfillment.delivery: false` etc. in product | Show available fulfillment options to user |

## Notes

- All data commands output JSON to stdout.
- The cart is account-level, not store-specific. Items go to the user's single Kroger cart regardless of which store was searched.
- The user picks their fulfillment store on kroger.com or the Kroger app.
- Tokens are stored locally at `~/.pantry-agent/tokens.json`.
- In background/headless mode, no browser is opened automatically. The agent controls auth by explicitly calling `kroger_start_auth`.
