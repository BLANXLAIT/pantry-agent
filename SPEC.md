# Pantry Agent Specification

An AI agent to assist with grocery shopping, starting with Kroger integration.

## Overview

**Purpose**: Help users manage their grocery shopping through natural language interactions with the Kroger API.

## Kroger API Integration

### App Registration

| Field           | Value                   |
| --------------- | ----------------------- |
| App Name        | pantry-agent            |
| Client ID       | `pantry-agent-bbccswyn` |
| Environment     | Certification           |
| Support Contact | ryan.niemes@gmail.com   |

### Granted Permissions

| API                | Scopes                | Description              |
| ------------------ | --------------------- | ------------------------ |
| Cart (Public)      | `cart.basic:write`    | Add/modify items in cart |
| Locations (Public) | _(no specific scope)_ | Find store locations     |
| Profile (Public)   | `profile.compact`     | Access user profile      |
| Products (Public)  | `product.compact`     | Search products          |

### OAuth2 Configuration

| Grant Type           | Purpose                            |
| -------------------- | ---------------------------------- |
| `authorization_code` | User authentication flow           |
| `client_credentials` | App-level access (no user context) |
| `refresh_token`      | Refresh expired access tokens      |

**Important**: You MUST request scopes when obtaining tokens. Without scopes, API calls return 403.

```bash
# Token request with scope
curl -X POST 'https://api-ce.kroger.com/v1/connect/oauth2/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Authorization: Basic ${BASE64(CLIENT_ID:CLIENT_SECRET)}' \
  -d 'grant_type=client_credentials&scope=product.compact'
```

### API Base URLs

- **Certification**: `https://api-ce.kroger.com/v1/`
- **Production**: `https://api.kroger.com/v1/`

### Verified API Endpoints

#### Locations API

- **Endpoint**: `GET /locations`
- **Scope**: None required
- **Parameters**: `filter.zipCode.near`, `filter.limit`
- **Returns**: Store details including locationId, address, hours, departments

```bash
GET /locations?filter.zipCode.near=45202&filter.limit=3
```

#### Products API

- **Endpoint**: `GET /products`
- **Scope**: `product.compact`
- **Parameters**: `filter.term`, `filter.locationId` (required), `filter.limit`
- **Returns**: Product details including UPC, price, inventory, images, nutrition

```bash
GET /products?filter.term=milk&filter.locationId=01400513&filter.limit=5
```

**Note**: `filter.locationId` is required for Products API.

## Complete API Reference

OpenAPI specs are in `/openapi/` directory.

| API           | File                         | Endpoints                               | Auth Required      |
| ------------- | ---------------------------- | --------------------------------------- | ------------------ |
| Authorization | `authorization-openapi.json` | `/authorize`, `/token`                  | Client credentials |
| Cart          | `cart-openapi.json`          | `PUT /cart/add`                         | User (auth code)   |
| Identity      | `identity-openapi.json`      | `GET /identity/profile`                 | User (auth code)   |
| Locations     | `locations-openapi.json`     | `/locations`, `/chains`, `/departments` | Client credentials |
| Products      | `products-openapi.json`      | `/products`, `/products/{id}`           | Client credentials |

### Cart API

**Endpoint**: `PUT /v1/cart/add`
**Scope**: `cart.basic:write`
**Rate Limit**: 5,000 calls/day

```json
// Request
{
  "items": [
    {
      "upc": "0001200016268",
      "quantity": 2,
      "modality": "PICKUP" // or "DELIVERY"
    }
  ]
}

// Response: 204 No Content (success)
```

### Identity API

**Endpoint**: `GET /v1/identity/profile`
**Scope**: `profile.compact`

Returns authenticated user's profile information.

### Locations API

| Endpoint                                   | Description                            |
| ------------------------------------------ | -------------------------------------- |
| `GET /locations?filter.zipCode.near=45202` | Find stores near zip                   |
| `GET /locations/{locationId}`              | Get specific store                     |
| `GET /chains`                              | List all chains (Kroger, Ralphs, etc.) |
| `GET /departments`                         | List all departments                   |

### Products API

| Endpoint                                               | Description          |
| ------------------------------------------------------ | -------------------- |
| `GET /products?filter.term=milk&filter.locationId=XXX` | Search products      |
| `GET /products/{productId}`                            | Get specific product |

**Required params**: `filter.locationId`
**Optional**: `filter.term`, `filter.brand`, `filter.limit`, `filter.start`

## Agent Capabilities

### MCP Tools

The agent exposes the following tools via Model Context Protocol:

| Tool              | Description                                  | Auth Required |
| ----------------- | -------------------------------------------- | ------------- |
| `search_products` | Search for products by term, brand, category | Client creds  |
| `get_product`     | Get detailed product info by ID              | Client creds  |
| `find_stores`     | Find Kroger stores near a location           | Client creds  |
| `get_store`       | Get store details (hours, departments)       | Client creds  |
| `add_to_cart`     | Add item(s) to user's Kroger cart            | User auth     |
| `get_profile`     | Get authenticated user's profile ID          | User auth     |

### Tool Definitions

#### search_products

```typescript
{
  name: "search_products",
  description: "Search for products at a Kroger store",
  inputSchema: {
    type: "object",
    properties: {
      term: { type: "string", description: "Search term (e.g., 'milk', 'organic bananas')" },
      locationId: { type: "string", description: "Store location ID (required)" },
      limit: { type: "number", description: "Max results (default: 10, max: 50)" }
    },
    required: ["term", "locationId"]
  }
}
```

#### get_product

```typescript
{
  name: "get_product",
  description: "Get detailed information about a specific product",
  inputSchema: {
    type: "object",
    properties: {
      productId: { type: "string", description: "Product ID or UPC" },
      locationId: { type: "string", description: "Store location ID for pricing" }
    },
    required: ["productId", "locationId"]
  }
}
```

#### find_stores

```typescript
{
  name: "find_stores",
  description: "Find Kroger stores near a location",
  inputSchema: {
    type: "object",
    properties: {
      zipCode: { type: "string", description: "ZIP code to search near" },
      limit: { type: "number", description: "Max results (default: 5)" }
    },
    required: ["zipCode"]
  }
}
```

#### get_store

```typescript
{
  name: "get_store",
  description: "Get details about a specific store",
  inputSchema: {
    type: "object",
    properties: {
      locationId: { type: "string", description: "Store location ID" }
    },
    required: ["locationId"]
  }
}
```

#### add_to_cart

```typescript
{
  name: "add_to_cart",
  description: "Add items to the user's Kroger cart. Requires user authentication.",
  inputSchema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            upc: { type: "string", description: "Product UPC (13 digits)" },
            quantity: { type: "number", description: "Quantity to add" },
            modality: { type: "string", enum: ["PICKUP", "DELIVERY"], description: "Fulfillment method" }
          },
          required: ["upc", "quantity"]
        }
      }
    },
    required: ["items"]
  }
}
```

#### get_profile

```typescript
{
  name: "get_profile",
  description: "Get the authenticated user's profile. Requires user authentication.",
  inputSchema: {
    type: "object",
    properties: {}
  }
}
```

### MCP Resources

| Resource       | URI                      | Description                        |
| -------------- | ------------------------ | ---------------------------------- |
| Auth Status    | `kroger://auth/status`   | Current authentication state       |
| Selected Store | `kroger://store/current` | Currently selected store (session) |

### MCP Prompts

| Prompt              | Description                                   |
| ------------------- | --------------------------------------------- |
| `grocery-assistant` | System prompt for grocery shopping assistance |

## Architecture

### Project Structure

```
pantry-agent/
├── src/
│   ├── api/                    # Kroger API Client (reusable)
│   │   ├── client.ts           # HTTP client with auth
│   │   ├── products.ts         # Products API
│   │   ├── locations.ts        # Locations API
│   │   ├── cart.ts             # Cart API
│   │   ├── identity.ts         # Identity API
│   │   └── types.ts            # TypeScript types from OpenAPI
│   │
│   ├── services/               # Business Logic (reusable)
│   │   ├── auth.service.ts     # Token management
│   │   ├── product.service.ts  # Product search/lookup
│   │   ├── store.service.ts    # Store finder
│   │   └── cart.service.ts     # Cart operations
│   │
│   ├── mcp/                    # MCP Server Layer
│   │   ├── server.ts           # MCP server setup
│   │   ├── tools.ts            # Tool implementations
│   │   ├── resources.ts        # Resource handlers
│   │   └── prompts.ts          # Prompt templates
│   │
│   └── index.ts                # Entry point
│
├── openapi/                    # API specs
├── .env                        # Credentials (gitignored)
└── package.json
```

### Tech Stack

| Layer       | Technology                      |
| ----------- | ------------------------------- |
| Runtime     | Node.js 20+                     |
| Language    | TypeScript                      |
| MCP SDK     | `@modelcontextprotocol/sdk`     |
| HTTP Client | `fetch` (native) or `got`       |
| Auth        | Custom OAuth2 implementation    |
| Validation  | `zod` for runtime type checking |

### Authentication Strategy

**Client Credentials (app-level)**:

- Used for: `search_products`, `get_product`, `find_stores`, `get_store`
- Token cached in memory, refreshed when expired

**User Auth (authorization code)**:

- Used for: `add_to_cart`, `get_profile`
- Challenge: MCP servers are typically non-interactive
- Options:
  1. **Pre-auth**: User authenticates via separate flow, tokens stored locally
  2. **Resource prompt**: Return auth URL, user completes in browser
  3. **OAuth device flow**: If Kroger supports it (unlikely)

**Chosen approach**: Pre-auth CLI flow

### User Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. User runs: npx pantry-agent auth                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  2. CLI starts local server on http://localhost:3000        │
│     Opens browser to Kroger consent page                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  3. User logs into Kroger, grants permissions               │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  4. Kroger redirects to localhost:3000/callback?code=XXX    │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  5. CLI exchanges code for tokens, saves to:                │
│     ~/.pantry-agent/tokens.json                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  6. CLI exits. MCP server can now use tokens.               │
└─────────────────────────────────────────────────────────────┘
```

### Token Storage

```
~/.pantry-agent/
├── tokens.json       # Encrypted refresh token + access token
└── config.json       # User preferences (default store, etc.)
```

**tokens.json structure:**

```json
{
  "accessToken": "eyJh...",
  "refreshToken": "FN20L...",
  "expiresAt": 1700000000000,
  "scope": "cart.basic:write profile.compact"
}
```

### CLI Commands

| Command                          | Description              |
| -------------------------------- | ------------------------ |
| `npx pantry-agent auth`          | Authenticate with Kroger |
| `npx pantry-agent auth --status` | Check auth status        |
| `npx pantry-agent auth --logout` | Clear stored tokens      |
| `npx pantry-agent serve`         | Start MCP server (stdio) |

### MCP Server Behavior

- On startup, checks for valid tokens in `~/.pantry-agent/tokens.json`
- If no tokens or expired refresh token:
  - User-auth tools (`add_to_cart`, `get_profile`) return error with instructions
  - App-level tools work normally
- If valid tokens:
  - All tools available
  - Auto-refresh access token when needed

## OAuth2 Authentication

### Roles

| Role                 | Entity       | Description                                 |
| -------------------- | ------------ | ------------------------------------------- |
| Resource Owner       | Customer/App | Entity that owns the protected resource     |
| Client               | pantry-agent | Application requesting protected resources  |
| Authorization Server | Kroger API   | Verifies identity, issues tokens            |
| Resource Server      | Kroger API   | Hosts protected resources, validates tokens |

### Scopes

Scopes authorize access to specific APIs. Format: `resource.shape.action`

| Scope              | Description               |
| ------------------ | ------------------------- |
| `product.compact`  | Read compact product data |
| `profile.compact`  | Read compact user profile |
| `cart.basic:write` | Add/modify cart items     |

### Grant Types

| Grant Type           | Purpose                                 | When to Use                                |
| -------------------- | --------------------------------------- | ------------------------------------------ |
| `client_credentials` | App-level access using client ID/secret | General data, no user context needed       |
| `authorization_code` | User grants permission to app           | Acting on behalf of a user (cart, profile) |
| `refresh_token`      | Refresh expired access token            | Avoid re-authenticating user               |

### Token Lifetimes

| Token Type    | Expires    | Notes                                                             |
| ------------- | ---------- | ----------------------------------------------------------------- |
| Access Token  | 30 minutes | Required in Authorization header for all API calls                |
| Refresh Token | 6 months   | **Single use** - invalidated after use, only with auth_code grant |

### Authentication Flows

#### Client Credentials Flow (App-level, no user)

```
1. App → POST /connect/oauth2/token (client_id:secret + grant_type=client_credentials)
2. Kroger → Access Token
3. App → API calls with Bearer token
```

Use for: Product search, store locations

#### Authorization Code Flow (User-context)

**Step 1: Redirect user to consent page**

```
GET /connect/oauth2/authorize
  ?scope={{SCOPES}}
  &response_type=code
  &client_id={{CLIENT_ID}}
  &redirect_uri={{REDIRECT_URI}}
```

| Parameter     | Required | Description                                                       |
| ------------- | -------- | ----------------------------------------------------------------- |
| scope         | Yes      | Space-separated scopes (e.g., `cart.basic:write profile.compact`) |
| response_type | Yes      | Always `code`                                                     |
| client_id     | Yes      | Application client ID                                             |
| redirect_uri  | Yes      | Must match registered callback URL                                |

**Step 2: User authenticates and grants permission**

User signs in to Kroger and approves the requested scopes.

**Step 3: Kroger redirects with authorization code**

```
https://YourRedirectUri.com/callback?code=zWrT1GkdshSadIowJW0Rm4w2kKhOzv1W
```

**Step 4: Exchange code for tokens**

```bash
curl -X POST 'https://api-ce.kroger.com/v1/connect/oauth2/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Authorization: Basic ${BASE64(CLIENT_ID:CLIENT_SECRET)}' \
  -d 'grant_type=authorization_code&code={{CODE}}&redirect_uri={{REDIRECT_URI}}'
```

**Step 5: Receive access + refresh tokens**

```json
{
  "expires_in": 1800,
  "access_token": "eyJh...",
  "token_type": "bearer",
  "refresh_token": "FN20LbaF2EWC6MPMWdemBwwnP4ZmX8"
}
```

Use for: Cart management, user profile

#### Refresh Token Flow

```bash
curl -X POST 'https://api-ce.kroger.com/v1/connect/oauth2/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Authorization: Basic ${BASE64(CLIENT_ID:CLIENT_SECRET)}' \
  -d 'grant_type=refresh_token&refresh_token={{REFRESH_TOKEN}}'
```

**Response**: New access token AND new refresh token (old refresh token is invalidated)

Use for: Maintaining user session without re-authentication

## Acceptable Use Policy (AUP)

Kroger API usage must comply with these policies:

### Identity API

| ✅ Allowed                 | ❌ Prohibited                             |
| -------------------------- | ----------------------------------------- |
| Display profile ID to user | Map/store data associated with profile ID |
|                            | Share profile ID with third parties       |

### Cart API

| ✅ Allowed                            | ❌ Prohibited                       |
| ------------------------------------- | ----------------------------------- |
| Add items user explicitly requests    | Add items without user knowledge    |
| Increase quantity user requests       | Track/share/store cart-derived data |
| Temp cache for display (session only) | Persist data after session ends     |

### Products API

| ✅ Allowed                       | ❌ Prohibited                        |
| -------------------------------- | ------------------------------------ |
| Display data exactly as returned | Compare prices with other retailers  |
| Omit irrelevant response fields  | Track customer searches              |
|                                  | Alter product name/description/price |
|                                  | Scrape/crawl to build database       |

### Locations API

| ✅ Allowed                       | ❌ Prohibited                  |
| -------------------------------- | ------------------------------ |
| Display data exactly as returned | Track customer location data   |
| Omit irrelevant response fields  | Alter names/addresses/hours    |
|                                  | Scrape/crawl to build database |

### Agent Design Implications

1. **No persistent user data** - Session-only storage for cart display
2. **Explicit user consent** - Only add to cart what user explicitly requests
3. **No analytics** - Don't track search patterns or frequently viewed products
4. **Pass-through display** - Show API data as-is, don't modify
5. **No caching products/locations** - Fresh API calls, no database building

## Security Notes

- **Never expose client_secret** - Treat like a password, keep server-side only
- **Store refresh tokens securely** - They grant long-term access
- **Tokens are user-scoped** - Can only access that user's resources
- **Scope-limited** - Token only works for requested scopes
- **URL encode all parameters** - Especially scopes and redirect_uri

## Implementation Reference

### Environment Variables

```bash
# .env (server-side only)
KROGER_CLIENT_ID=pantry-agent-bbccswyn
KROGER_CLIENT_SECRET=<secret>
KROGER_OAUTH2_BASE_URL=https://api-ce.kroger.com/v1/connect/oauth2
KROGER_API_BASE_URL=https://api-ce.kroger.com/v1
KROGER_REDIRECT_URL=http://localhost:3000/callback
```

### Client-Side: Initiate Login

```javascript
function redirectToLogin() {
  const scope = encodeURIComponent('cart.basic:write profile.compact product.compact');
  const url =
    `${config.oauth2BaseUrl}/authorize?` +
    `client_id=${encodeURIComponent(config.clientId)}` +
    `&redirect_uri=${encodeURIComponent(config.redirectUrl)}` +
    `&response_type=code` +
    `&scope=${scope}`;
  window.location = url;
}
```

### Server-Side: Callback Handler

```javascript
// GET /callback?code=AUTHORIZATION_CODE
async function callbackHandler(req, res) {
  const params = url.parse(req.url, true).query;
  if (!params.code) {
    return res.sendStatus(400);
  }

  const token = await exchangeCodeForToken(params.code);

  // Store tokens securely (cookies, session, or database)
  res.cookie('accToken', token.access_token, { httpOnly: true, secure: true });
  res.cookie('refToken', token.refresh_token, { httpOnly: true, secure: true });
  res.redirect('/');
}
```

### Server-Side: Token Exchange

```javascript
async function exchangeCodeForToken(code) {
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${oauth2BaseUrl}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUrl)}`,
  });

  return await response.json();
}
```

### Token Storage Strategy

| Storage           | Pros                     | Cons                          |
| ----------------- | ------------------------ | ----------------------------- |
| HTTP-only cookies | XSS-safe, auto-sent      | CSRF vulnerable, limited size |
| Server session    | Secure, flexible         | Requires session management   |
| Database          | Persistent, multi-device | More infrastructure           |

For this agent: Consider database storage for refresh tokens (6-month lifetime) with short-lived access tokens in memory/session.

### Refresh Token Strategies

**Proactive approach** (recommended):

- Store access token expiration time (`Date.now() + expires_in * 1000`)
- Check before each API call, refresh if <5 min remaining
- Avoids failed requests

**Reactive approach**:

- Wait for 401 response, then refresh
- Simpler but causes one failed request

```javascript
// 401 Unauthorized response when token expired
{
  "error": "invalid_token",
  "error_description": "The access token is invalid or has expired"
}
```

### Server-Side: Refresh Token Service

```javascript
async function refreshAccessToken(refreshToken) {
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${oauth2BaseUrl}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });

  if (response.status === 400) {
    // Refresh token invalid or expired - user must re-authenticate
    throw new Error('Refresh token expired');
  }

  // Response includes NEW access token AND NEW refresh token
  // Old refresh token is now invalid!
  return await response.json();
}
```

**Critical**: After refreshing, you MUST store the new refresh token. The old one is invalidated immediately.

### Error Handling

| HTTP Status | Error           | Meaning                       | Action                               |
| ----------- | --------------- | ----------------------------- | ------------------------------------ |
| 401         | `invalid_token` | Access token expired          | Use refresh token                    |
| 400         | `invalid_grant` | Refresh token invalid/expired | Re-authenticate user                 |
| 403         | -               | Missing required scope        | Request new token with correct scope |

## Notes

_(Additional details to be added)_
