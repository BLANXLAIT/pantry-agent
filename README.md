# Pantry Agent

An MCP (Model Context Protocol) server for grocery shopping at Kroger-owned stores. Search products, find stores, check prices, and manage your cart through AI assistants like Claude.

Works with **all Kroger-owned banners**: Kroger, Ralphs, Fred Meyer, King Soopers, Harris Teeter, Food 4 Less, Fry's, Smith's, QFC, Mariano's, Pick 'n Save, and more — covering ~2,800 stores across the US.

## Features

- **Product Search** - Search by name, brand, or description at any Kroger-owned store
- **Store Finder** - Find nearby stores across all Kroger banners
- **Product Details** - Get pricing, stock availability, and nutrition info
- **Cart Management** - Add items to your cart (requires authentication)
- **Profile Access** - View your account profile
- **Agent-managed OAuth** - Browser-based Kroger login guided by the AI agent

## Installation

### Claude Code

```bash
claude mcp add pantry-agent -- npx -y @blanxlait/pantry-agent
```

### Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "pantry-agent": {
      "command": "npx",
      "args": ["-y", "@blanxlait/pantry-agent"]
    }
  }
}
```

### Authentication

For cart and profile features, the agent manages Kroger authentication for you using an OAuth flow:

1. The agent calls `kroger_start_auth` to begin the flow and get the authorization URL.
2. The agent presents the URL — open it in your browser.
3. Log in to Kroger and authorize the app. A local callback server (port 3000) captures the token automatically.
4. Confirm to the agent that login is complete, and it retries your request.

Tokens are stored locally at `~/.pantry-agent/tokens.json`. To manage authentication manually:

```bash
npx @blanxlait/pantry-agent auth           # Authenticate interactively (opens browser)
npx @blanxlait/pantry-agent auth --status  # Check if logged in
npx @blanxlait/pantry-agent auth --logout  # Clear stored tokens
```

## Available Tools

| Tool                 | Description                                          | Auth Required |
| -------------------- | ---------------------------------------------------- | ------------- |
| `search_products`    | Search products by term                              | No            |
| `get_product`        | Get product details by ID                            | No            |
| `find_stores`        | Find stores near a ZIP code                          | No            |
| `get_store`          | Get store details and hours                          | No            |
| `add_to_cart`        | Add items to cart                                    | Yes           |
| `get_profile`        | Get user profile                                     | Yes           |
| `kroger_start_auth`  | Start browser-based OAuth; returns authorization URL | —             |

## Available Prompts

| Prompt              | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `grocery-assistant` | System prompt for grocery shopping assistance            |
| `kroger-oauth`      | Step-by-step guide for agent-managed Kroger OAuth login  |

## Example Usage

Once configured, you can ask Claude things like:

- "Search for organic milk at my local Kroger"
- "Find grocery stores near 90210" (returns Ralphs, Food 4 Less, etc.)
- "What are the nutrition facts for this product?"
- "Add 2 gallons of milk to my cart"
- "Find me a Ralphs in San Diego and search for avocados"

## OAuth Flow for Developers

The OAuth flow uses a Firebase Functions proxy so client secrets never leave the server. Here is the end-to-end sequence:

```
Agent                  MCP Server              Firebase Proxy       Kroger
  |                       |                         |                  |
  |-- kroger_start_auth ->|                         |                  |
  |                       |-- GET authStart ------->|                  |
  |                       |<- redirect URL ---------| redirect to ---->|
  |<- auth URL -----------|                                            |
  |                       |                                            |
  | (user opens URL, logs in to Kroger in browser)                     |
  |                       |                                            |
  |                       |<-- GET /callback?code=... (local port 3000)|
  |                       |-- POST authToken ------->|                  |
  |                       |                          |-- token req ---->|
  |                       |<- access/refresh token --|<- tokens --------|
  |                       | (tokens stored at ~/.pantry-agent/tokens.json)
  |                       |                                            |
  | (user confirms done)  |                                            |
  |-- add_to_cart ------->|-- PUT /cart/add (Bearer token) ----------->|
  |<- success ------------|<- 204 No Content ----------------------------|
```

Token refresh happens proactively 5 minutes before expiry. Refresh tokens are single-use and are replaced on each refresh.

## Requirements

- Node.js 20 or later
- A Kroger account (for cart/profile features — works with any Kroger-owned banner login)

## Privacy

- Product search and store lookup work without authentication
- Cart and profile features require Kroger OAuth login
- Tokens are stored locally on your machine at `~/.pantry-agent/tokens.json` with `0o600` permissions
- No data is sent to third parties beyond the Kroger API and the Firebase Functions proxy (which holds the client credentials)

## Disclaimer

Pantry Agent is not affiliated with, endorsed by, or sponsored by The Kroger Co.

## License

MIT
