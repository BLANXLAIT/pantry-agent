#!/usr/bin/env node
/**
 * Pantry Agent CLI
 * Commands for authentication and server management
 */

import { createServer } from 'node:http';
import { URL } from 'node:url';
import open from 'open';
import { KrogerService } from './services/kroger.service.js';
import { startMcpServer } from './mcp/server.js';
import { loadConfig } from './config.js';

const REDIRECT_PORT = 3000;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

/**
 * Send an HTML response with consistent styling
 */
function sendHtmlResponse(
  res: import('node:http').ServerResponse,
  statusCode: number,
  icon: string,
  title: string,
  message: string
): void {
  res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1>${icon} ${title}</h1>
        <p>${message}</p>
        <p>You can close this window.</p>
      </body>
    </html>
  `);
}

async function authCommand(options: { status?: boolean; logout?: boolean }): Promise<void> {
  const config = loadConfig();
  const kroger = new KrogerService(config);
  const auth = kroger.getAuthService();

  // Check status
  if (options.status) {
    const isAuth = await auth.isUserAuthenticated();
    if (isAuth) {
      console.log('✓ Authenticated with Kroger');
      const tokens = auth.getStoredTokens();
      if (tokens) {
        console.log(`  Scope: ${tokens.scope}`);
        console.log(`  Expires: ${new Date(tokens.expiresAt).toLocaleString()}`);
      }
    } else {
      console.log('✗ Not authenticated');
      console.log('  Run `pantry-agent auth` to log in');
    }
    return;
  }

  // Logout
  if (options.logout) {
    auth.clearTokens();
    console.log('✓ Logged out');
    return;
  }

  // Start auth flow
  const scope = kroger.getUserScope();
  const authUrl = auth.getAuthorizationUrl(REDIRECT_URI, scope);

  console.log('Starting Kroger authentication...');
  console.log('A browser window will open. Please log in and authorize the app.\n');

  // Create temporary server to receive callback
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${REDIRECT_PORT}`);

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        sendHtmlResponse(res, 400, '❌', 'Authentication Failed', `Error: ${error}`);
        console.error(`\n✗ Authentication failed: ${error}`);
        server.close();
        process.exit(1);
      }

      if (!code) {
        sendHtmlResponse(
          res,
          400,
          '❌',
          'Authentication Failed',
          'No authorization code received.'
        );
        console.error('\n✗ Authentication failed: No authorization code received');
        server.close();
        process.exit(1);
      }

      try {
        await auth.handleCallback(code, REDIRECT_URI, scope);

        sendHtmlResponse(
          res,
          200,
          '✅',
          'Authentication Successful',
          'You are now logged in to Kroger.<br>You can return to your terminal.'
        );
        console.log('\n✓ Authentication successful!');
        console.log('  You can now use cart features with Claude.');
        server.close();
        process.exit(0);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        sendHtmlResponse(res, 500, '❌', 'Authentication Failed', message);
        console.error(`\n✗ Authentication failed: ${message}`);
        server.close();
        process.exit(1);
      }
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(REDIRECT_PORT, () => {
    console.log(`Listening for callback on http://localhost:${REDIRECT_PORT}/callback`);
    console.log('Opening browser...\n');
    open(authUrl);
  });

  // Timeout after 5 minutes
  setTimeout(
    () => {
      console.error('\n✗ Authentication timed out');
      server.close();
      process.exit(1);
    },
    5 * 60 * 1000
  );
}

async function serveCommand(): Promise<void> {
  const config = loadConfig();
  const kroger = new KrogerService(config);
  await startMcpServer(kroger);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'auth':
      await authCommand({
        status: args.includes('--status'),
        logout: args.includes('--logout'),
      });
      break;

    case 'serve':
      await serveCommand();
      break;

    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(`
Pantry Agent - Kroger MCP Server & CLI

Usage:
  pantry-agent <command> [options]

Commands:
  stores <zip> [--limit N]                         Find nearby stores
  store <locationId>                               Get store details
  search "<term>" --store <id> [--limit N] [--brand X]  Search products
  product <id> --store <id>                        Get product details
  cart add <upc> [--qty N] [--modality PICKUP|DELIVERY]  Add to cart

  auth              Authenticate with Kroger
  auth --status     Check authentication status
  auth --logout     Clear stored tokens
  serve             Start the MCP server (stdio)
  help              Show this help message

Examples:
  pantry-agent stores 45174
  pantry-agent search "milk" --store 01400411
  pantry-agent product 0001111041660 --store 01400411
  pantry-agent cart add 0001111041660 --qty 2
  pantry-agent auth
`);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run `pantry-agent help` for usage information.');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
