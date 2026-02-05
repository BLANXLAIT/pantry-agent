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
      expect(listToolsHandler).toBeDefined();

      const result = await listToolsHandler({ method: 'tools/list', params: {} });
      const toolNames = result.tools.map((t: any) => t.name);

      expect(toolNames).toContain('search_products');
      expect(toolNames).toContain('get_product');
      expect(toolNames).toContain('find_stores');
      expect(toolNames).toContain('get_store');
      expect(toolNames).toContain('add_to_cart');
      expect(toolNames).toContain('get_profile');
    });
  });

  describe('Tool Execution', () => {
    it('should execute search_products tool', async () => {
      const mockProducts = [
        {
          productId: '001',
          upc: '0001111041700',
          description: 'Kroger 2% Milk',
          brand: 'Kroger',
          items: [{ price: { regular: 3.99 }, inventory: { stockLevel: 'HIGH' } }],
          aisleLocations: [{ description: 'Dairy' }],
        },
      ];

      mockKroger.searchProducts.mockResolvedValueOnce(mockProducts);

      const callToolHandler = (server.server as any)._requestHandlers.get('tools/call');
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'search_products',
          arguments: { term: 'milk', locationId: '01400943' },
        },
      });

      expect(mockKroger.searchProducts).toHaveBeenCalledWith({
        term: 'milk',
        locationId: '01400943',
        limit: 10,
      });

      expect(result.content).toHaveLength(1);
      const parsed = JSON.parse((result.content[0] as any).text);
      expect(parsed.count).toBe(1);
      expect(parsed.products[0].productId).toBe('001');
    });

    it('should execute find_stores tool', async () => {
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
      ];

      mockKroger.findStores.mockResolvedValueOnce(mockStores);

      const callToolHandler = (server.server as any)._requestHandlers.get('tools/call');
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'find_stores',
          arguments: { zipCode: '45202' },
        },
      });

      expect(mockKroger.findStores).toHaveBeenCalledWith({ zipCode: '45202', limit: 5 });

      expect(result.content).toHaveLength(1);
      const parsed = JSON.parse((result.content[0] as any).text);
      expect(parsed.count).toBe(1);
      expect(parsed.stores[0].locationId).toBe('01400943');
    });

    it('should handle auth required errors gracefully', async () => {
      mockKroger.getProfile.mockRejectedValueOnce(
        new Error('AUTH_REQUIRED: A browser window has been opened for Kroger login.')
      );

      const callToolHandler = (server.server as any)._requestHandlers.get('tools/call');
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'get_profile',
          arguments: {},
        },
      });

      // Should NOT be an error - it's informational
      expect((result as any).isError).toBeUndefined();
      expect((result.content[0] as any).text).toContain('Opening browser');
    });
  });
});
