/**
 * MCP Tools
 * Tool registration for the MCP server
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KrogerService } from '../services/kroger.service.js';

// Zod schemas for input validation
const SearchProductsInput = {
  term: z.string().min(1).describe('Search term (e.g., "milk", "organic bananas")'),
  locationId: z.string().min(1).describe('Store location ID (get from find_stores)'),
  limit: z.number().int().min(1).max(50).default(10).describe('Maximum results (default: 10, max: 50)'),
};

const GetProductInput = {
  productId: z.string().min(1).describe('Product ID or UPC'),
  locationId: z.string().min(1).describe('Store location ID for pricing and stock info'),
};

const FindStoresInput = {
  zipCode: z.string().regex(/^\d{5}$/, 'ZIP code must be 5 digits').describe('5-digit ZIP code'),
  limit: z.number().int().min(1).max(20).default(5).describe('Maximum results (default: 5, max: 20)'),
};

const GetStoreInput = {
  locationId: z.string().min(1).describe('Store location ID'),
};

const CartItemInput = z.object({
  upc: z.string().regex(/^\d{13}$/, 'UPC must be 13 digits').describe('Product UPC (13 digits)'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').describe('Quantity to add'),
  modality: z.enum(['PICKUP', 'DELIVERY']).optional().describe('Fulfillment method'),
});

const AddToCartInput = {
  items: z.array(CartItemInput).min(1, 'At least one item is required').describe('Items to add to cart'),
};

export function registerTools(server: McpServer, kroger: KrogerService): void {
  // Register search_products tool
  server.registerTool(
    'search_products',
    {
      description: 'Search for products at a Kroger store by name, brand, or description',
      inputSchema: SearchProductsInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ term, locationId, limit }) => {
      try {
        const products = await kroger.searchProducts({ term, locationId, limit });

        if (products.length === 0) {
          return {
            content: [{ type: 'text' as const, text: `No products found for "${term}" at this store.` }],
          };
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

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // Register get_product tool
  server.registerTool(
    'get_product',
    {
      description:
        'Get detailed information about a specific product including price, stock, and nutrition',
      inputSchema: GetProductInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ productId, locationId }) => {
      try {
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

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(formatted, null, 2) }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // Register find_stores tool
  server.registerTool(
    'find_stores',
    {
      description: 'Find Kroger stores near a ZIP code',
      inputSchema: FindStoresInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ zipCode, limit }) => {
      try {
        const stores = await kroger.findStores({ zipCode, limit });

        if (stores.length === 0) {
          return {
            content: [{ type: 'text' as const, text: `No stores found near ZIP code ${zipCode}.` }],
          };
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

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // Register get_store tool
  server.registerTool(
    'get_store',
    {
      description: 'Get detailed information about a specific store including hours and departments',
      inputSchema: GetStoreInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ locationId }) => {
      try {
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

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(formatted, null, 2) }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // Register add_to_cart tool
  server.registerTool(
    'add_to_cart',
    {
      description: "Add items to the user's Kroger cart. Requires user authentication.",
      inputSchema: AddToCartInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ items }) => {
      try {
        await kroger.addToCart({ items });

        const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
        return {
          content: [
            { type: 'text' as const, text: `Successfully added ${itemCount} item(s) to your Kroger cart.` },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // Register get_profile tool
  server.registerTool(
    'get_profile',
    {
      description: "Get the authenticated user's Kroger profile. Requires user authentication.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const profile = await kroger.getProfile();
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(profile, null, 2) }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}

function handleToolError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  if (message.startsWith('AUTH_REQUIRED:')) {
    // Auto-auth flow was started - return helpful message, not an error
    return {
      content: [
        {
          type: 'text' as const,
          text:
            'Opening browser for Kroger login...\n\n' +
            'Please complete the login in your browser, then try your request again.',
        },
      ],
    };
  }
  return {
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    isError: true as const,
  };
}
