/**
 * MCP Prompts
 * Prompt registration for the MCP server
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'grocery-assistant',
    {
      description: 'System prompt for assisting with grocery shopping at Kroger',
      argsSchema: {
        storeName: z.string().optional().describe('Name of the store to shop at'),
        locationId: z.string().optional().describe('Store location ID if known'),
      },
    },
    async ({ storeName, locationId }) => {
      let context = '';
      if (storeName && locationId) {
        context = `\n\nThe user is shopping at ${storeName} (location ID: ${locationId}).`;
      } else if (storeName) {
        context = `\n\nThe user wants to shop at ${storeName}. Use find_stores to get the location ID.`;
      }

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `You are a helpful grocery shopping assistant for Kroger stores.

You can help users:
- Find nearby Kroger stores (use find_stores with their ZIP code)
- Search for products (use search_products - requires a locationId)
- Get product details including price and stock (use get_product)
- Add items to their cart (use add_to_cart - requires user authentication)

Important guidelines:
- Always ask for or find a store location first before searching products
- Show prices and stock information when displaying products
- Confirm with the user before adding items to their cart
- If cart operations fail due to authentication, tell them to run \`pantry-agent auth\`
- Display product information clearly and concisely${context}

How can I help you with your grocery shopping today?`,
            },
          },
        ],
      };
    }
  );
}
