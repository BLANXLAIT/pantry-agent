/**
 * MCP Tools
 * Tool definitions and handlers for the MCP server
 */

import type {
  ListToolsRequest,
  CallToolRequest,
  Tool,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import type { KrogerService } from '../services/kroger.service.js';

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: 'search_products',
    description: 'Search for products at a Kroger store by name, brand, or description',
    inputSchema: {
      type: 'object',
      properties: {
        term: { type: 'string', description: 'Search term (e.g., "milk", "organic bananas")' },
        locationId: { type: 'string', description: 'Store location ID (get from find_stores)' },
        limit: { type: 'number', description: 'Maximum results (default: 10, max: 50)' },
      },
      required: ['term', 'locationId'],
    },
  },
  {
    name: 'get_product',
    description:
      'Get detailed information about a specific product including price, stock, and nutrition',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'Product ID or UPC' },
        locationId: { type: 'string', description: 'Store location ID for pricing and stock info' },
      },
      required: ['productId', 'locationId'],
    },
  },
  {
    name: 'find_stores',
    description: 'Find Kroger stores near a ZIP code',
    inputSchema: {
      type: 'object',
      properties: {
        zipCode: { type: 'string', description: '5-digit ZIP code' },
        limit: { type: 'number', description: 'Maximum results (default: 5, max: 20)' },
      },
      required: ['zipCode'],
    },
  },
  {
    name: 'get_store',
    description: 'Get detailed information about a specific store including hours and departments',
    inputSchema: {
      type: 'object',
      properties: {
        locationId: { type: 'string', description: 'Store location ID' },
      },
      required: ['locationId'],
    },
  },
  {
    name: 'add_to_cart',
    description: "Add items to the user's Kroger cart. Requires user authentication.",
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              upc: { type: 'string', description: 'Product UPC (13 digits)' },
              quantity: { type: 'number', description: 'Quantity to add' },
              modality: {
                type: 'string',
                enum: ['PICKUP', 'DELIVERY'],
                description: 'Fulfillment method',
              },
            },
            required: ['upc', 'quantity'],
          },
          description: 'Items to add to cart',
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'get_profile',
    description: "Get the authenticated user's Kroger profile. Requires user authentication.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

export function getToolsHandler() {
  return async (_request: ListToolsRequest) => ({
    tools: TOOLS,
  });
}

export function callToolHandler(kroger: KrogerService) {
  return async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'search_products': {
          const {
            term,
            locationId,
            limit = 10,
          } = args as { term: string; locationId: string; limit?: number };
          const products = await kroger.searchProducts({ term, locationId, limit });

          if (products.length === 0) {
            return textResult(`No products found for "${term}" at this store.`);
          }

          const formatted = products.map((p) => ({
            productId: p.productId,
            upc: p.upc,
            name: p.description,
            brand: p.brand,
            price: p.items?.[0]?.price?.regular,
            inStock: p.items?.[0]?.inventory?.stockLevel === 'HIGH',
            aisle: p.aisleLocations?.[0]?.description,
          }));

          return textResult(JSON.stringify(formatted, null, 2));
        }

        case 'get_product': {
          const { productId, locationId } = args as { productId: string; locationId: string };
          const product = await kroger.getProduct(productId, locationId);

          const formatted = {
            productId: product.productId,
            upc: product.upc,
            name: product.description,
            brand: product.brand,
            categories: product.categories,
            price: product.items?.[0]?.price,
            size: product.items?.[0]?.size,
            inStock: product.items?.[0]?.inventory?.stockLevel,
            fulfillment: product.items?.[0]?.fulfillment,
            aisle: product.aisleLocations?.[0],
          };

          return textResult(JSON.stringify(formatted, null, 2));
        }

        case 'find_stores': {
          const { zipCode, limit = 5 } = args as { zipCode: string; limit?: number };
          const stores = await kroger.findStores({ zipCode, limit });

          if (stores.length === 0) {
            return textResult(`No stores found near ZIP code ${zipCode}.`);
          }

          const formatted = stores.map((s) => ({
            locationId: s.locationId,
            name: s.name,
            chain: s.chain,
            address: `${s.address.addressLine1}, ${s.address.city}, ${s.address.state} ${s.address.zipCode}`,
            phone: s.phone,
          }));

          return textResult(JSON.stringify(formatted, null, 2));
        }

        case 'get_store': {
          const { locationId } = args as { locationId: string };
          const store = await kroger.getStore(locationId);

          const formatted = {
            locationId: store.locationId,
            name: store.name,
            chain: store.chain,
            address: store.address,
            phone: store.phone,
            hours: store.hours,
            departments: store.departments?.map((d) => d.name),
          };

          return textResult(JSON.stringify(formatted, null, 2));
        }

        case 'add_to_cart': {
          const { items } = args as {
            items: Array<{ upc: string; quantity: number; modality?: 'PICKUP' | 'DELIVERY' }>;
          };
          await kroger.addToCart({ items });

          const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
          return textResult(`Successfully added ${itemCount} item(s) to your Kroger cart.`);
        }

        case 'get_profile': {
          const profile = await kroger.getProfile();
          return textResult(JSON.stringify(profile, null, 2));
        }

        default:
          return errorResult(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not authenticated')) {
        return errorResult(
          'Not authenticated. Please run `pantry-agent auth` in your terminal to log in to Kroger.'
        );
      }
      return errorResult(`Error: ${message}`);
    }
  };
}

function textResult(text: string): { content: TextContent[] } {
  return {
    content: [{ type: 'text', text }],
  };
}

function errorResult(text: string): { content: TextContent[]; isError: true } {
  return {
    content: [{ type: 'text', text }],
    isError: true,
  };
}
