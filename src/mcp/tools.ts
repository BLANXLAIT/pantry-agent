/**
 * MCP Tools
 * Tool definitions and handlers for the MCP server
 */

import { z } from 'zod';
import type {
  ListToolsRequest,
  CallToolRequest,
  Tool,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import type { KrogerService } from '../services/kroger.service.js';

// Zod schemas for input validation
const SearchProductsInput = z
  .object({
    term: z.string().min(1, 'Search term is required'),
    locationId: z.string().min(1, 'Location ID is required'),
    limit: z.number().int().min(1).max(50).default(10),
  })
  .strict();

const GetProductInput = z
  .object({
    productId: z.string().min(1, 'Product ID is required'),
    locationId: z.string().min(1, 'Location ID is required'),
  })
  .strict();

const FindStoresInput = z
  .object({
    zipCode: z.string().regex(/^\d{5}$/, 'ZIP code must be 5 digits'),
    limit: z.number().int().min(1).max(20).default(5),
  })
  .strict();

const GetStoreInput = z
  .object({
    locationId: z.string().min(1, 'Location ID is required'),
  })
  .strict();

const CartItemInput = z.object({
  upc: z.string().regex(/^\d{13}$/, 'UPC must be 13 digits'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  modality: z.enum(['PICKUP', 'DELIVERY']).optional(),
});

const AddToCartInput = z
  .object({
    items: z.array(CartItemInput).min(1, 'At least one item is required'),
  })
  .strict();

const GetProfileInput = z.object({}).strict();

// Tool definitions with annotations
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
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
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
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
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
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
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
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
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
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: 'get_profile',
    description: "Get the authenticated user's Kroger profile. Requires user authentication.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
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
          const parsed = SearchProductsInput.safeParse(args);
          if (!parsed.success) {
            return errorResult(`Invalid input: ${parsed.error.issues[0].message}`);
          }
          const { term, locationId, limit } = parsed.data;
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

          const result = {
            count: formatted.length,
            has_more: products.length >= limit,
            products: formatted,
          };

          return textResult(JSON.stringify(result, null, 2));
        }

        case 'get_product': {
          const parsed = GetProductInput.safeParse(args);
          if (!parsed.success) {
            return errorResult(`Invalid input: ${parsed.error.issues[0].message}`);
          }
          const { productId, locationId } = parsed.data;
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
          const parsed = FindStoresInput.safeParse(args);
          if (!parsed.success) {
            return errorResult(`Invalid input: ${parsed.error.issues[0].message}`);
          }
          const { zipCode, limit } = parsed.data;
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

          const result = {
            count: formatted.length,
            has_more: stores.length >= limit,
            stores: formatted,
          };

          return textResult(JSON.stringify(result, null, 2));
        }

        case 'get_store': {
          const parsed = GetStoreInput.safeParse(args);
          if (!parsed.success) {
            return errorResult(`Invalid input: ${parsed.error.issues[0].message}`);
          }
          const { locationId } = parsed.data;
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
          const parsed = AddToCartInput.safeParse(args);
          if (!parsed.success) {
            return errorResult(`Invalid input: ${parsed.error.issues[0].message}`);
          }
          const { items } = parsed.data;
          await kroger.addToCart({ items });

          const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
          return textResult(`Successfully added ${itemCount} item(s) to your Kroger cart.`);
        }

        case 'get_profile': {
          const parsed = GetProfileInput.safeParse(args);
          if (!parsed.success) {
            return errorResult(`Invalid input: ${parsed.error.issues[0].message}`);
          }
          const profile = await kroger.getProfile();
          return textResult(JSON.stringify(profile, null, 2));
        }

        default:
          return errorResult(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.startsWith('AUTH_REQUIRED:')) {
        // Auto-auth flow was started - return helpful message, not an error
        return textResult(
          'Opening browser for Kroger login...\n\n' +
            'Please complete the login in your browser, then try your request again.'
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
