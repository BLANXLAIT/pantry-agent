/**
 * Tests for MCP Tools
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMcpServer } from './server.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KrogerService } from '../services/kroger.service.js';

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

// Helper to call tools through the MCP server
async function callTool(server: McpServer, name: string, args: any) {
  const callToolHandler = (server.server as any)._requestHandlers.get('tools/call');
  return await callToolHandler({
    method: 'tools/call',
    params: { name, arguments: args },
  });
}

describe('MCP Tools', () => {
  let mockKroger: ReturnType<typeof createMockKrogerService>;
  let server: McpServer;

  beforeEach(() => {
    mockKroger = createMockKrogerService();
    server = createMcpServer(mockKroger as unknown as KrogerService);
    vi.clearAllMocks();
  });

  describe('Tool Registration', () => {
    it('should register all expected tools', async () => {
      const listToolsHandler = (server.server as any)._requestHandlers.get('tools/list');
      const result = await listToolsHandler({ method: 'tools/list', params: {} });
      const toolNames = result.tools.map((t: any) => t.name);

      expect(toolNames).toContain('search_products');
      expect(toolNames).toContain('get_product');
      expect(toolNames).toContain('find_stores');
      expect(toolNames).toContain('get_store');
      expect(toolNames).toContain('add_to_cart');
      expect(toolNames).toContain('get_profile');
    });

    it('should have proper annotations for search_products', async () => {
      const listToolsHandler = (server.server as any)._requestHandlers.get('tools/list');
      const result = await listToolsHandler({ method: 'tools/list', params: {} });
      const searchTool = result.tools.find((t: any) => t.name === 'search_products');
      
      expect(searchTool).toBeDefined();
      expect(searchTool?.annotations?.readOnlyHint).toBe(true);
      expect(searchTool?.annotations?.idempotentHint).toBe(true);
    });

    it('should have proper annotations for add_to_cart', async () => {
      const listToolsHandler = (server.server as any)._requestHandlers.get('tools/list');
      const result = await listToolsHandler({ method: 'tools/list', params: {} });
      const cartTool = result.tools.find((t: any) => t.name === 'add_to_cart');
      
      expect(cartTool).toBeDefined();
      expect(cartTool?.annotations?.readOnlyHint).toBe(false);
      expect(cartTool?.annotations?.idempotentHint).toBe(false);
    });
  });

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

      const result = await callTool(server, 'search_products', {
        term: 'milk',
        locationId: '01400943',
      });

      expect(mockKroger.searchProducts).toHaveBeenCalledWith({
        term: 'milk',
        locationId: '01400943',
        limit: 10,
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const parsed = JSON.parse((result.content[0] as any).text);
      expect(parsed.count).toBe(2);
      expect(parsed.has_more).toBe(false);
      expect(parsed.products).toHaveLength(2);
      expect(parsed.products[0].productId).toBe('001');
      expect(parsed.products[0].price).toBe(3.99);
      expect(parsed.products[0].inStock).toBe(true);
      expect(parsed.products[0].aisle).toBe('Dairy');
      expect(parsed.products[1].inStock).toBe(false);
    });

    it('should return message when no products found', async () => {
      mockKroger.searchProducts.mockResolvedValueOnce([]);

      const result = await callTool(server, 'search_products', {
        term: 'nonexistent',
        locationId: '01400943',
      });

      expect((result.content[0] as any).text).toContain('No products found');
    });

    it('should use custom limit when provided', async () => {
      mockKroger.searchProducts.mockResolvedValueOnce([]);

      await callTool(server, 'search_products', {
        term: 'eggs',
        locationId: '01400943',
        limit: 25,
      });

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

      const result = await callTool(server, 'get_product', {
        productId: '001',
        locationId: '01400943',
      });

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

      const result = await callTool(server, 'find_stores', { zipCode: '45202' });

      expect(mockKroger.findStores).toHaveBeenCalledWith({ zipCode: '45202', limit: 5 });

      const parsed = JSON.parse((result.content[0] as any).text);
      expect(parsed.count).toBe(2);
      expect(parsed.has_more).toBe(false);
      expect(parsed.stores).toHaveLength(2);
      expect(parsed.stores[0].locationId).toBe('01400943');
      expect(parsed.stores[0].address).toBe('123 Main St, Cincinnati, OH 45202');
      expect(parsed.stores[0].phone).toBe('513-555-1234');
    });

    it('should return message when no stores found', async () => {
      mockKroger.findStores.mockResolvedValueOnce([]);

      const result = await callTool(server, 'find_stores', { zipCode: '99999' });

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

      const result = await callTool(server, 'get_store', { locationId: '01400943' });

      expect(mockKroger.getStore).toHaveBeenCalledWith('01400943');

      const parsed = JSON.parse((result.content[0] as any).text);
      expect(parsed.locationId).toBe('01400943');
      expect(parsed.departments).toContain('Bakery');
    });
  });

  describe('add_to_cart', () => {
    it('should add items to cart and return success message', async () => {
      mockKroger.addToCart.mockResolvedValueOnce(undefined);

      const result = await callTool(server, 'add_to_cart', {
        items: [
          { upc: '0001111041700', quantity: 2 },
          { upc: '0001111041701', quantity: 1 },
        ],
      });

      expect(mockKroger.addToCart).toHaveBeenCalledWith({
        items: [
          { upc: '0001111041700', quantity: 2 },
          { upc: '0001111041701', quantity: 1 },
        ],
      });

      expect((result.content[0] as any).text).toContain('Successfully added 3 item(s)');
    });

    it('should return auth prompt when not authenticated', async () => {
      mockKroger.addToCart.mockRejectedValueOnce(
        new Error('AUTH_REQUIRED: A browser window has been opened for Kroger login.')
      );

      const result = await callTool(server, 'add_to_cart', {
        items: [{ upc: '0001111041700', quantity: 1 }],
      });

      // Should NOT be an error - it's informational
      expect((result as any).isError).toBeUndefined();
      expect((result.content[0] as any).text).toContain('Opening browser');
      expect((result.content[0] as any).text).toContain('try your request again');
    });
  });

  describe('get_profile', () => {
    it('should get profile and return details', async () => {
      const mockProfile = { id: 'user-123-abc' };
      mockKroger.getProfile.mockResolvedValueOnce(mockProfile);

      const result = await callTool(server, 'get_profile', {});

      expect(mockKroger.getProfile).toHaveBeenCalled();

      const parsed = JSON.parse((result.content[0] as any).text);
      expect(parsed.id).toBe('user-123-abc');
    });

    it('should return auth prompt when not authenticated', async () => {
      mockKroger.getProfile.mockRejectedValueOnce(
        new Error('AUTH_REQUIRED: A browser window has been opened for Kroger login.')
      );

      const result = await callTool(server, 'get_profile', {});

      // Should NOT be an error - it's informational
      expect((result as any).isError).toBeUndefined();
      expect((result.content[0] as any).text).toContain('Opening browser');
    });
  });

  describe('error handling', () => {
    it('should handle generic errors', async () => {
      mockKroger.searchProducts.mockRejectedValueOnce(new Error('Network error'));

      const result = await callTool(server, 'search_products', {
        term: 'milk',
        locationId: '01400943',
      });

      expect((result as any).isError).toBe(true);
      expect((result.content[0] as any).text).toContain('Error: Network error');
    });
  });
});
