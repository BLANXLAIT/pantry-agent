/**
 * Tests for MCP Tools
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getToolsHandler, callToolHandler } from './tools.js';
import type { KrogerService } from '../services/kroger.service.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

const createMockKrogerService = () => ({
  searchProducts: vi.fn(),
  getProduct: vi.fn(),
  findStores: vi.fn(),
  getStore: vi.fn(),
  addToCart: vi.fn(),
  getProfile: vi.fn(),
  isUserAuthenticated: vi.fn(),
  getAuthService: vi.fn(),
  getUserScope: vi.fn(),
});

describe('MCP Tools', () => {
  let mockKroger: ReturnType<typeof createMockKrogerService>;

  beforeEach(() => {
    mockKroger = createMockKrogerService();
    vi.clearAllMocks();
  });

  describe('getToolsHandler', () => {
    it('should return list of tools', async () => {
      const handler = getToolsHandler();
      const result = await handler({} as any);

      expect(result.tools).toBeDefined();
      expect(result.tools.length).toBeGreaterThan(0);

      // Verify expected tools exist
      const toolNames = result.tools.map((t) => t.name);
      expect(toolNames).toContain('search_products');
      expect(toolNames).toContain('get_product');
      expect(toolNames).toContain('find_stores');
      expect(toolNames).toContain('get_store');
      expect(toolNames).toContain('add_to_cart');
      expect(toolNames).toContain('get_profile');
    });

    it('should have proper schema for search_products', async () => {
      const handler = getToolsHandler();
      const result = await handler({} as any);

      const searchTool = result.tools.find((t) => t.name === 'search_products');
      expect(searchTool).toBeDefined();
      expect(searchTool?.inputSchema.required).toContain('term');
      expect(searchTool?.inputSchema.required).toContain('locationId');
    });

    it('should have proper schema for add_to_cart', async () => {
      const handler = getToolsHandler();
      const result = await handler({} as any);

      const cartTool = result.tools.find((t) => t.name === 'add_to_cart');
      expect(cartTool).toBeDefined();
      expect(cartTool?.inputSchema.required).toContain('items');
    });
  });

  describe('callToolHandler', () => {
    describe('search_products', () => {
      it('should search products and return formatted results', async () => {
        const mockProducts = [
          {
            productId: '001',
            upc: '0001111041700',
            description: 'Kroger 2% Milk',
            brand: 'Kroger',
            items: [{ price: { regular: 3.99 }, inventory: { stockLevel: 'HIGH' } }],
            aisleLocations: [{ description: 'Dairy' }],
          },
          {
            productId: '002',
            upc: '0001111041701',
            description: 'Kroger Whole Milk',
            brand: 'Kroger',
            items: [{ price: { regular: 4.29 }, inventory: { stockLevel: 'LOW' } }],
          },
        ];

        mockKroger.searchProducts.mockResolvedValueOnce(mockProducts);

        const handler = callToolHandler(mockKroger as unknown as KrogerService);
        const request: CallToolRequest = {
          method: 'tools/call',
          params: {
            name: 'search_products',
            arguments: { term: 'milk', locationId: '01400943' },
          },
        };

        const result = await handler(request);

        expect(mockKroger.searchProducts).toHaveBeenCalledWith({
          term: 'milk',
          locationId: '01400943',
          limit: 10,
        });

        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');

        const parsed = JSON.parse((result.content[0] as any).text);
        expect(parsed).toHaveLength(2);
        expect(parsed[0].productId).toBe('001');
        expect(parsed[0].price).toBe(3.99);
        expect(parsed[0].inStock).toBe(true);
        expect(parsed[0].aisle).toBe('Dairy');
        expect(parsed[1].inStock).toBe(false);
      });

      it('should return message when no products found', async () => {
        mockKroger.searchProducts.mockResolvedValueOnce([]);

        const handler = callToolHandler(mockKroger as unknown as KrogerService);
        const request: CallToolRequest = {
          method: 'tools/call',
          params: {
            name: 'search_products',
            arguments: { term: 'nonexistent', locationId: '01400943' },
          },
        };

        const result = await handler(request);

        expect((result.content[0] as any).text).toContain('No products found');
      });

      it('should use custom limit when provided', async () => {
        mockKroger.searchProducts.mockResolvedValueOnce([]);

        const handler = callToolHandler(mockKroger as unknown as KrogerService);
        const request: CallToolRequest = {
          method: 'tools/call',
          params: {
            name: 'search_products',
            arguments: { term: 'eggs', locationId: '01400943', limit: 25 },
          },
        };

        await handler(request);

        expect(mockKroger.searchProducts).toHaveBeenCalledWith({
          term: 'eggs',
          locationId: '01400943',
          limit: 25,
        });
      });
    });

    describe('get_product', () => {
      it('should get product and return formatted details', async () => {
        const mockProduct = {
          productId: '001',
          upc: '0001111041700',
          description: 'Kroger 2% Milk',
          brand: 'Kroger',
          categories: ['Dairy', 'Milk'],
          items: [
            {
              size: '1 gal',
              price: { regular: 3.99, promo: 2.99 },
              inventory: { stockLevel: 'HIGH' },
              fulfillment: { curbside: true, delivery: true, inStore: true, shipToHome: false },
            },
          ],
          aisleLocations: [{ description: 'Dairy', number: '12' }],
        };

        mockKroger.getProduct.mockResolvedValueOnce(mockProduct);

        const handler = callToolHandler(mockKroger as unknown as KrogerService);
        const request: CallToolRequest = {
          method: 'tools/call',
          params: {
            name: 'get_product',
            arguments: { productId: '001', locationId: '01400943' },
          },
        };

        const result = await handler(request);

        expect(mockKroger.getProduct).toHaveBeenCalledWith('001', '01400943');

        const parsed = JSON.parse((result.content[0] as any).text);
        expect(parsed.productId).toBe('001');
        expect(parsed.size).toBe('1 gal');
        expect(parsed.price.regular).toBe(3.99);
        expect(parsed.price.promo).toBe(2.99);
        expect(parsed.fulfillment.curbside).toBe(true);
      });
    });

    describe('find_stores', () => {
      it('should find stores and return formatted results', async () => {
        const mockStores = [
          {
            locationId: '01400943',
            name: 'Kroger',
            chain: 'KROGER',
            address: {
              addressLine1: '123 Main St',
              city: 'Cincinnati',
              state: 'OH',
              zipCode: '45202',
            },
            phone: '513-555-1234',
          },
          {
            locationId: '01400944',
            name: 'Kroger Marketplace',
            chain: 'KROGER',
            address: {
              addressLine1: '456 Oak Ave',
              city: 'Cincinnati',
              state: 'OH',
              zipCode: '45203',
            },
          },
        ];

        mockKroger.findStores.mockResolvedValueOnce(mockStores);

        const handler = callToolHandler(mockKroger as unknown as KrogerService);
        const request: CallToolRequest = {
          method: 'tools/call',
          params: {
            name: 'find_stores',
            arguments: { zipCode: '45202' },
          },
        };

        const result = await handler(request);

        expect(mockKroger.findStores).toHaveBeenCalledWith({ zipCode: '45202', limit: 5 });

        const parsed = JSON.parse((result.content[0] as any).text);
        expect(parsed).toHaveLength(2);
        expect(parsed[0].locationId).toBe('01400943');
        expect(parsed[0].address).toBe('123 Main St, Cincinnati, OH 45202');
        expect(parsed[0].phone).toBe('513-555-1234');
      });

      it('should return message when no stores found', async () => {
        mockKroger.findStores.mockResolvedValueOnce([]);

        const handler = callToolHandler(mockKroger as unknown as KrogerService);
        const request: CallToolRequest = {
          method: 'tools/call',
          params: {
            name: 'find_stores',
            arguments: { zipCode: '99999' },
          },
        };

        const result = await handler(request);

        expect((result.content[0] as any).text).toContain('No stores found');
      });
    });

    describe('get_store', () => {
      it('should get store and return formatted details', async () => {
        const mockStore = {
          locationId: '01400943',
          name: 'Kroger',
          chain: 'KROGER',
          address: {
            addressLine1: '123 Main St',
            city: 'Cincinnati',
            state: 'OH',
            zipCode: '45202',
          },
          phone: '513-555-1234',
          hours: {
            timezone: 'America/New_York',
            gmtOffset: '-05:00',
            open24: false,
            monday: { open: '06:00', close: '23:00', open24: false },
          },
          departments: [{ departmentId: 'bakery', name: 'Bakery' }],
        };

        mockKroger.getStore.mockResolvedValueOnce(mockStore);

        const handler = callToolHandler(mockKroger as unknown as KrogerService);
        const request: CallToolRequest = {
          method: 'tools/call',
          params: {
            name: 'get_store',
            arguments: { locationId: '01400943' },
          },
        };

        const result = await handler(request);

        expect(mockKroger.getStore).toHaveBeenCalledWith('01400943');

        const parsed = JSON.parse((result.content[0] as any).text);
        expect(parsed.locationId).toBe('01400943');
        expect(parsed.departments).toContain('Bakery');
      });
    });

    describe('add_to_cart', () => {
      it('should add items to cart and return success message', async () => {
        mockKroger.addToCart.mockResolvedValueOnce(undefined);

        const handler = callToolHandler(mockKroger as unknown as KrogerService);
        const request: CallToolRequest = {
          method: 'tools/call',
          params: {
            name: 'add_to_cart',
            arguments: {
              items: [
                { upc: '0001111041700', quantity: 2 },
                { upc: '0001111041701', quantity: 1 },
              ],
            },
          },
        };

        const result = await handler(request);

        expect(mockKroger.addToCart).toHaveBeenCalledWith({
          items: [
            { upc: '0001111041700', quantity: 2 },
            { upc: '0001111041701', quantity: 1 },
          ],
        });

        expect((result.content[0] as any).text).toContain('Successfully added 3 item(s)');
      });

      it('should return auth error when not authenticated', async () => {
        mockKroger.addToCart.mockRejectedValueOnce(
          new Error('User not authenticated. Run `pantry-agent auth` to log in.')
        );

        const handler = callToolHandler(mockKroger as unknown as KrogerService);
        const request: CallToolRequest = {
          method: 'tools/call',
          params: {
            name: 'add_to_cart',
            arguments: {
              items: [{ upc: '0001111041700', quantity: 1 }],
            },
          },
        };

        const result = await handler(request);

        expect((result as any).isError).toBe(true);
        expect((result.content[0] as any).text).toContain('Not authenticated');
        expect((result.content[0] as any).text).toContain('pantry-agent auth');
      });
    });

    describe('get_profile', () => {
      it('should get profile and return details', async () => {
        const mockProfile = { id: 'user-123-abc' };
        mockKroger.getProfile.mockResolvedValueOnce(mockProfile);

        const handler = callToolHandler(mockKroger as unknown as KrogerService);
        const request: CallToolRequest = {
          method: 'tools/call',
          params: {
            name: 'get_profile',
            arguments: {},
          },
        };

        const result = await handler(request);

        expect(mockKroger.getProfile).toHaveBeenCalled();

        const parsed = JSON.parse((result.content[0] as any).text);
        expect(parsed.id).toBe('user-123-abc');
      });

      it('should return auth error when not authenticated', async () => {
        mockKroger.getProfile.mockRejectedValueOnce(
          new Error('User not authenticated. Run `pantry-agent auth` to log in.')
        );

        const handler = callToolHandler(mockKroger as unknown as KrogerService);
        const request: CallToolRequest = {
          method: 'tools/call',
          params: {
            name: 'get_profile',
            arguments: {},
          },
        };

        const result = await handler(request);

        expect((result as any).isError).toBe(true);
        expect((result.content[0] as any).text).toContain('Not authenticated');
      });
    });

    describe('unknown tool', () => {
      it('should return error for unknown tool', async () => {
        const handler = callToolHandler(mockKroger as unknown as KrogerService);
        const request: CallToolRequest = {
          method: 'tools/call',
          params: {
            name: 'unknown_tool',
            arguments: {},
          },
        };

        const result = await handler(request);

        expect((result as any).isError).toBe(true);
        expect((result.content[0] as any).text).toContain('Unknown tool: unknown_tool');
      });
    });

    describe('error handling', () => {
      it('should handle generic errors', async () => {
        mockKroger.searchProducts.mockRejectedValueOnce(new Error('Network error'));

        const handler = callToolHandler(mockKroger as unknown as KrogerService);
        const request: CallToolRequest = {
          method: 'tools/call',
          params: {
            name: 'search_products',
            arguments: { term: 'milk', locationId: '01400943' },
          },
        };

        const result = await handler(request);

        expect((result as any).isError).toBe(true);
        expect((result.content[0] as any).text).toContain('Error: Network error');
      });
    });
  });
});
