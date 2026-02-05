# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build
npm run build                    # Compile TypeScript to dist/
npm run dev                      # Watch mode compilation

# Test
npm run test                     # Run tests once
npm run test:watch               # Watch mode
npm run test:coverage            # Coverage report

# Lint & Type Check
npm run lint                     # ESLint
npm run typecheck                # TypeScript checking

# Run
npm run start                    # Start MCP server (stdio)
npm run auth                     # CLI auth flow (opens browser)
node dist/cli.js auth --status   # Check auth status
node dist/cli.js auth --logout   # Clear tokens

# Firebase Functions (from functions/ directory)
npm run build                    # Compile to lib/
npm run serve                    # Local emulator
npm run deploy                   # Deploy to Firebase
npm run test                     # Run function tests
```

## Architecture

### Three-Tier Design

```
┌─────────────────────────────────────────────────────────────┐
│  MCP Layer (src/mcp/)                                       │
│  - server.ts: MCP server setup, stdio transport             │
│  - tools.ts: 6 tools (search, products, stores, cart, etc.) │
│  - resources.ts: Auth status resource                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│  Service Layer (src/services/)                              │
│  - kroger.service.ts: High-level facade for all operations  │
│  - auth.service.ts: Token lifecycle (app + user tokens)     │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│  API Layer (src/api/)                                       │
│  - client.ts: KrogerClient with OAuth2 methods              │
│  - products.ts, locations.ts, cart.ts, identity.ts          │
└─────────────────────────────────────────────────────────────┘
```

### Firebase Functions Proxy

Firebase Functions (`functions/src/index.ts`) acts as an OAuth proxy so client secrets don't ship with the MCP server.

**Production URLs:**
| Function | URL | Purpose |
|----------|-----|---------|
| `authStart` | https://authstart-xcf2umzgsq-uc.a.run.app | Redirects to Kroger consent page |
| `authToken` | https://authtoken-xcf2umzgsq-uc.a.run.app | Exchanges code for tokens |
| `authRefresh` | https://authrefresh-xcf2umzgsq-uc.a.run.app | Refreshes access tokens |
| `authClientToken` | https://authclienttoken-xcf2umzgsq-uc.a.run.app | Gets client credentials tokens |

**Base URL:** `https://{function}-xcf2umzgsq-uc.a.run.app`

Secrets stored in Firebase Secrets: `KROGER_CLIENT_ID`, `KROGER_CLIENT_SECRET`

### Authentication Flow

**Two token types:**

1. **Client credentials** (app-level): For product search, store lookup. No user login needed.
2. **Authorization code** (user-level): For cart, profile. Requires user OAuth consent.

**Auto-auth:** When a user-level tool (add_to_cart, get_profile) is called without authentication, the server automatically opens a browser for Kroger login. User completes login, then retries the request.

**Manual auth:** Run `pantry-agent auth` CLI command to authenticate ahead of time.

**Token storage:** `~/.pantry-agent/tokens.json`

**Token refresh:** Proactive refresh 5 minutes before expiry. Refresh tokens are single-use.

## Key Files

- `SPEC.md` - Detailed API specification, OAuth flows, acceptable use policy
- `openapi/` - Kroger API OpenAPI specs (products, locations, cart, identity)
- `claude-desktop-config.json` - MCP server config for Claude Desktop
- `.mcp.json` - Local MCP configuration

## Testing Patterns

Tests are co-located with source files (`*.test.ts`). Uses Vitest with globals enabled.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Component', () => {
  beforeEach(() => {
    /* setup */
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should do X', async () => {
    mockFetch.mockResolvedValueOnce({
      /* response */
    });
    const result = await instance.method();
    expect(result).toEqual(expected);
  });
});
```

Mock external HTTP calls (fetch), test through service layer.

## Environment

- Node.js 20+ required
- ES modules (`"type": "module"`)
- TypeScript strict mode

## Configuration

**Default (no configuration needed):** Uses hardcoded Firebase Functions URL. Just run:

```bash
npx @blanxlait/pantry-agent
```

**Direct Credentials (local dev only):**

```bash
KROGER_CLIENT_ID=your_client_id
KROGER_CLIENT_SECRET=your_secret
```

Only set these if you have your own Kroger API credentials for development.
