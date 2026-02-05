/**
 * Integration Tests Example
 *
 * These tests demonstrate how to test the full flow from MCP tools
 * through the service layer to the API client. They use mocked fetch
 * but exercise the real integration between components.
 *
 * To run actual integration tests against the Kroger API:
 * 1. Set KROGER_CLIENT_ID and KROGER_CLIENT_SECRET environment variables
 * 2. Remove the fetch mock
 * 3. Mark tests with .skip that require user authentication
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KrogerService } from './services/kroger.service.js';
import { callToolHandler } from './mcp/tools.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

// Mock global fetch for all tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock fs for auth service
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/mock/home'),
}));

describe('Integration Tests', () => {
  let krogerService: KrogerService;
  let toolHandler: ReturnType<typeof callToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();

    krogerService = new KrogerService({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      environment: 'certification',
    });

    toolHandler = callToolHandler(krogerService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Product Search Flow', () => {
    it('should search products through MCP tool to API', async () => {
      // Mock client credentials token response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'app-token-123',
            token_type: 'bearer',
            expires_in: 1800,
          }),
      });

      // Mock product search response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: [
              {
                productId: '0001111041700',
                upc: '0001111041700',
                description: 'Kroger 2% Reduced Fat Milk',
                brand: 'Kroger',
                items: [
                  {
                    itemId: 'item-1',
                    price: { regular: 3.99 },
                    inventory: { stockLevel: 'HIGH' },
                  },
                ],
                aisleLocations: [{ description: 'Dairy' }],
              },
            ],
            meta: { pagination: { start: 0, limit: 10, total: 1 } },
          }),
      });

      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'search_products',
          arguments: { term: 'milk', locationId: '01400943' },
        },
      };

      const result = await toolHandler(request);

      // Verify token was fetched first
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('/connect/oauth2/token'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      );

      // Verify product search was called with token
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/products?filter.term=milk'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer app-token-123',
          }),
        })
      );

      // Verify result format
      expect(result.content).toHaveLength(1);
      const parsed = JSON.parse((result.content[0] as any).text);
      expect(parsed.count).toBe(1);
      expect(parsed.products).toHaveLength(1);
      expect(parsed.products[0].productId).toBe('0001111041700');
      expect(parsed.products[0].price).toBe(3.99);
      expect(parsed.products[0].inStock).toBe(true);
    });

    it('should cache app token for subsequent requests', async () => {
      // First request - token fetch + product search
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'app-token-123',
              token_type: 'bearer',
              expires_in: 1800,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              data: [],
              meta: { pagination: { start: 0, limit: 10, total: 0 } },
            }),
        })
        // Second request - only product search (token cached)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              data: [],
              meta: { pagination: { start: 0, limit: 10, total: 0 } },
            }),
        });

      // First search
      await toolHandler({
        method: 'tools/call',
        params: {
          name: 'search_products',
          arguments: { term: 'milk', locationId: '01400943' },
        },
      });

      // Second search (should use cached token)
      await toolHandler({
        method: 'tools/call',
        params: {
          name: 'search_products',
          arguments: { term: 'eggs', locationId: '01400943' },
        },
      });

      // Should have called fetch 3 times total (1 token + 2 products)
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // First call should be token
      expect(mockFetch.mock.calls[0][0]).toContain('/connect/oauth2/token');
      // Second and third should be product searches
      expect(mockFetch.mock.calls[1][0]).toContain('/products');
      expect(mockFetch.mock.calls[2][0]).toContain('/products');
    });
  });

  describe('Store Search Flow', () => {
    it('should find stores through MCP tool to API', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'app-token-123',
              token_type: 'bearer',
              expires_in: 1800,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              data: [
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
                  geolocation: {
                    latitude: 39.1031,
                    longitude: -84.512,
                    latLng: '39.1031,-84.512',
                  },
                },
              ],
              meta: { pagination: { start: 0, limit: 5, total: 1 } },
            }),
        });

      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'find_stores',
          arguments: { zipCode: '45202' },
        },
      };

      const result = await toolHandler(request);

      // Verify locations API was called
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/locations?'),
        expect.any(Object)
      );
      expect(mockFetch.mock.calls[1][0]).toContain('filter.zipCode.near=45202');

      // Verify result format
      const parsed = JSON.parse((result.content[0] as any).text);
      expect(parsed.count).toBe(1);
      expect(parsed.stores).toHaveLength(1);
      expect(parsed.stores[0].locationId).toBe('01400943');
      expect(parsed.stores[0].address).toBe('123 Main St, Cincinnati, OH 45202');
    });
  });

  describe('Error Handling Flow', () => {
    it('should handle API errors gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'app-token-123',
              token_type: 'bearer',
              expires_in: 1800,
            }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () =>
            Promise.resolve({
              error_description: 'Service temporarily unavailable',
            }),
        });

      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'search_products',
          arguments: { term: 'milk', locationId: '01400943' },
        },
      };

      const result = await toolHandler(request);

      expect((result as any).isError).toBe(true);
      expect((result.content[0] as any).text).toContain(
        'Error: API request failed: Service temporarily unavailable'
      );
    });

    it('should handle token fetch failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
        json: () =>
          Promise.resolve({
            error_description: 'Invalid client credentials',
          }),
      });

      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'search_products',
          arguments: { term: 'milk', locationId: '01400943' },
        },
      };

      const result = await toolHandler(request);

      expect((result as any).isError).toBe(true);
      expect((result.content[0] as any).text).toContain('Invalid client credentials');
    });
  });

  describe('Get Product Details Flow', () => {
    it('should get product details through MCP tool to API', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'app-token-123',
              token_type: 'bearer',
              expires_in: 1800,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              data: [
                {
                  productId: '0001111041700',
                  upc: '0001111041700',
                  description: 'Kroger 2% Reduced Fat Milk',
                  brand: 'Kroger',
                  categories: ['Dairy', 'Milk'],
                  items: [
                    {
                      itemId: 'item-1',
                      size: '1 gal',
                      price: { regular: 3.99, promo: 2.99 },
                      inventory: { stockLevel: 'HIGH' },
                      fulfillment: {
                        curbside: true,
                        delivery: true,
                        inStore: true,
                        shipToHome: false,
                      },
                    },
                  ],
                  aisleLocations: [{ description: 'Dairy', number: '12' }],
                },
              ],
              meta: { pagination: { start: 0, limit: 1, total: 1 } },
            }),
        });

      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'get_product',
          arguments: { productId: '0001111041700', locationId: '01400943' },
        },
      };

      const result = await toolHandler(request);

      // Verify product API was called
      expect(mockFetch.mock.calls[1][0]).toContain('/products/0001111041700');
      expect(mockFetch.mock.calls[1][0]).toContain('filter.locationId=01400943');

      // Verify result format
      const parsed = JSON.parse((result.content[0] as any).text);
      expect(parsed.productId).toBe('0001111041700');
      expect(parsed.size).toBe('1 gal');
      expect(parsed.price.regular).toBe(3.99);
      expect(parsed.price.promo).toBe(2.99);
      expect(parsed.fulfillment.curbside).toBe(true);
    });
  });
});

/**
 * Example of a live integration test (skipped by default)
 *
 * To run live tests:
 * 1. Set KROGER_CLIENT_ID and KROGER_CLIENT_SECRET
 * 2. Change describe.skip to describe
 *
 * Note: Live tests require actual Kroger API credentials and
 * will make real API calls.
 */
describe.skip('Live Integration Tests', () => {
  it('should search for products using real API', async () => {
    // This test would use real API calls
    // Requires valid credentials in environment
    const service = new KrogerService({
      clientId: process.env.KROGER_CLIENT_ID!,
      clientSecret: process.env.KROGER_CLIENT_SECRET!,
      environment: 'certification',
    });

    const products = await service.searchProducts({
      term: 'milk',
      locationId: '01400943', // Replace with valid location
      limit: 5,
    });

    expect(products.length).toBeGreaterThan(0);
    expect(products[0].productId).toBeDefined();
  });

  it('should find stores using real API', async () => {
    const service = new KrogerService({
      clientId: process.env.KROGER_CLIENT_ID!,
      clientSecret: process.env.KROGER_CLIENT_SECRET!,
      environment: 'certification',
    });

    const stores = await service.findStores({
      zipCode: '45202',
      limit: 3,
    });

    expect(stores.length).toBeGreaterThan(0);
    expect(stores[0].locationId).toBeDefined();
  });
});
