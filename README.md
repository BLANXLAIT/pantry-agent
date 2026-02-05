# Pantry Agent

An MCP (Model Context Protocol) server for Kroger grocery shopping. Search products, find stores, and manage your cart through AI assistants like Claude.

## Features

- **Product Search** - Search Kroger's catalog by name, brand, or description
- **Store Finder** - Find Kroger stores near any ZIP code
- **Product Details** - Get pricing, stock availability, and nutrition info
- **Cart Management** - Add items to your Kroger cart (requires authentication)
- **Profile Access** - View your Kroger account profile

## Installation

### Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "pantry-agent": {
      "command": "npx",
      "args": ["-y", "@blanxlait/pantry-agent"],
      "env": {
        "FIREBASE_FUNCTIONS_URL": "https://xcf2umzgsq-uc.a.run.app",
        "KROGER_ENVIRONMENT": "production"
      }
    }
  }
}
```

### Authentication (Optional)

For cart and profile features, authenticate with your Kroger account:

```bash
npx @blanxlait/pantry-agent auth
```

This opens a browser window for Kroger login. Your tokens are stored locally at `~/.pantry-agent/tokens.json`.

Check auth status:

```bash
npx @blanxlait/pantry-agent auth --status
```

Log out:

```bash
npx @blanxlait/pantry-agent auth --logout
```

## Available Tools

| Tool              | Description                 | Auth Required |
| ----------------- | --------------------------- | ------------- |
| `search_products` | Search products by term     | No            |
| `get_product`     | Get product details by ID   | No            |
| `find_stores`     | Find stores near a ZIP code | No            |
| `get_store`       | Get store details and hours | No            |
| `add_to_cart`     | Add items to cart           | Yes           |
| `get_profile`     | Get user profile            | Yes           |

## Example Usage

Once configured, you can ask Claude things like:

- "Search for organic milk at Kroger"
- "Find Kroger stores near 45202"
- "What are the nutrition facts for this product?"
- "Add 2 gallons of milk to my Kroger cart"

## Requirements

- Node.js 20 or later
- A Kroger account (for cart/profile features)

## Privacy

- Product search and store lookup work without authentication
- Cart and profile features require Kroger OAuth login
- Tokens are stored locally on your machine
- No data is sent to third parties

## License

MIT
