/**
 * MCP Server Setup
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { KrogerService } from '../services/kroger.service.js';
import { registerTools } from './tools.js';
import { registerResources } from './resources.js';
import { registerPrompts } from './prompts.js';

export function createMcpServer(kroger: KrogerService): McpServer {
  const server = new McpServer(
    {
      name: 'pantry-agent',
      version: '0.3.1',
    },
    {
      instructions: `Pantry Agent provides grocery shopping tools for all Kroger-owned stores (Kroger, Ralphs, Fred Meyer, King Soopers, Harris Teeter, Food 4 Less, Fry's, Smith's, QFC, and more).

Workflow:
1. Find the user's nearest store with find_stores (ask for ZIP code if needed). The response includes the chain name (Kroger, Ralphs, etc.).
2. Use the locationId from find_stores for all product searches.
3. search_products and get_product work without authentication and return pricing, stock, fulfillment, and aisle info.
4. Use preview_cart with a locationId to validate item pricing and availability before adding to cart — no authentication needed.
5. Before cart or profile operations, call check_auth_status to see if the user is already authenticated.
6. If not authenticated, call kroger_start_auth to get the authorization URL and present it to the user. Wait for them to confirm login, then retry.
7. Always confirm with the user before adding items to their cart.
8. The cart is account-level, not store-specific. Items added via any store go to the user's single Kroger cart. The user picks their fulfillment store separately on kroger.com or the app.`,
    },
  );

  // Register tools
  registerTools(server, kroger);

  // Register resources
  registerResources(server, kroger);

  // Register prompts
  registerPrompts(server);

  return server;
}

export async function startMcpServer(kroger: KrogerService): Promise<void> {
  const server = createMcpServer(kroger);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Log to stderr (stdout is reserved for MCP protocol)
  console.error('Pantry Agent MCP Server running on stdio');
}
