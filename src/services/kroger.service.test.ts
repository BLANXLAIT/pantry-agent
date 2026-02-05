/**
 * Tests for KrogerService
 *
 * This tests the KrogerService class by mocking external API calls.
 * Due to the complex module dependencies, we test the service behavior
 * by mocking fetch at the network level.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KrogerService } from './kroger.service.js';
import type { CartItem } from '../api/types.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock fs for auth service token storage
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/mock/home'),
}));

import { existsSync, readFileSync } from 'node:fs';
const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe('KrogerService', () => {
  let service: KrogerService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockExistsSync.mockReturnValue(false);

    service = new KrogerService({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      environment: 'certification',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserScope', () => {
    it('should return user scopes string', () => {
      const scope = service.getUserScope();
      expect(scope).toBe('cart.basic:write profile.compact');
    });
  });

  describe('searchProducts', () => {
    it('should search products with app token', async () => {
      // Mock token response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'app-token',
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
                description: 'Kroger 2% Milk',
                brand: 'Kroger',
              },
            ],
            meta: { pagination: { start: 0, limit: 10, total: 1 } },
          }),
      });

      const result = await service.searchProducts({
        term: 'milk',
        locationId: '01400943',
      });

      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe('0001111041700');

      // Verify token was requested
      expect(mockFetch.mock.calls[0][0]).toContain('/connect/oauth2/token');
      // Verify product search was called
      expect(mockFetch.mock.calls[1][0]).toContain('/products?');
      expect(mockFetch.mock.calls[1][0]).toContain('filter.term=milk');
    });

    it('should use custom limit when provided', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'app-token',
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
              meta: { pagination: { start: 0, limit: 25, total: 0 } },
            }),
        });

      await service.searchProducts({
        term: 'eggs',
        locationId: '01400943',
        limit: 25,
      });

      expect(mockFetch.mock.calls[1][0]).toContain('filter.limit=25');
    });
  });

  describe('getProduct', () => {
    it('should get product by ID', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'app-token',
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
                  description: 'Kroger 2% Milk',
                  brand: 'Kroger',
                },
              ],
              meta: { pagination: { start: 0, limit: 1, total: 1 } },
            }),
        });

      const result = await service.getProduct('0001111041700', '01400943');

      expect(result.productId).toBe('0001111041700');
      expect(mockFetch.mock.calls[1][0]).toContain('/products/0001111041700');
    });
  });

  describe('findStores', () => {
    it('should find stores by ZIP code', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'app-token',
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

      const result = await service.findStores({ zipCode: '45202' });

      expect(result).toHaveLength(1);
      expect(result[0].locationId).toBe('01400943');
      expect(mockFetch.mock.calls[1][0]).toContain('/locations?');
      expect(mockFetch.mock.calls[1][0]).toContain('filter.zipCode.near=45202');
    });
  });

  describe('getStore', () => {
    it('should get store by ID', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'app-token',
              token_type: 'bearer',
              expires_in: 1800,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              data: {
                locationId: '01400943',
                name: 'Kroger',
                chain: 'KROGER',
                address: {
                  addressLine1: '123 Main St',
                  city: 'Cincinnati',
                  state: 'OH',
                  zipCode: '45202',
                },
                geolocation: {
                  latitude: 39.1031,
                  longitude: -84.512,
                  latLng: '39.1031,-84.512',
                },
              },
            }),
        });

      const result = await service.getStore('01400943');

      expect(result.locationId).toBe('01400943');
      expect(mockFetch.mock.calls[1][0]).toContain('/locations/01400943');
    });
  });

  describe('isUserAuthenticated', () => {
    it('should return false when no tokens stored', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await service.isUserAuthenticated();

      expect(result).toBe(false);
    });

    it('should return true when valid tokens exist', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          accessToken: 'user-token',
          expiresAt: Date.now() + 1800000,
          scope: 'cart.basic:write',
        })
      );

      const result = await service.isUserAuthenticated();

      expect(result).toBe(true);
    });
  });

  describe('addToCart', () => {
    const items: CartItem[] = [
      { upc: '0001111041700', quantity: 2 },
      { upc: '0001111041701', quantity: 1 },
    ];

    it('should throw error when user not authenticated', async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(service.addToCart({ items })).rejects.toThrow(
        'User not authenticated. Run `pantry-agent auth` to log in.'
      );
    });

    it('should add items to cart with user token', async () => {
      // Set up stored user token
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          accessToken: 'user-token',
          expiresAt: Date.now() + 1800000,
          scope: 'cart.basic:write',
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await service.addToCart({ items });

      expect(mockFetch.mock.calls[0][0]).toContain('/cart/add');
      expect(mockFetch.mock.calls[0][1]?.method).toBe('PUT');
      expect(mockFetch.mock.calls[0][1]?.headers).toMatchObject({
        Authorization: 'Bearer user-token',
      });
    });
  });

  describe('getProfile', () => {
    it('should throw error when user not authenticated', async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(service.getProfile()).rejects.toThrow(
        'User not authenticated. Run `pantry-agent auth` to log in.'
      );
    });

    it('should get profile with user token', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          accessToken: 'user-token',
          expiresAt: Date.now() + 1800000,
          scope: 'profile.compact',
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: { id: 'user-123-abc' },
          }),
      });

      const result = await service.getProfile();

      expect(result.id).toBe('user-123-abc');
      expect(mockFetch.mock.calls[0][0]).toContain('/identity/profile');
      expect(mockFetch.mock.calls[0][1]?.headers).toMatchObject({
        Authorization: 'Bearer user-token',
      });
    });
  });

  describe('token caching', () => {
    it('should reuse cached app token for subsequent requests', async () => {
      // First request - token + search
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'app-token',
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
        // Second request - only search (token should be cached)
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
      await service.searchProducts({ term: 'milk', locationId: '01400943' });
      // Second search
      await service.searchProducts({ term: 'eggs', locationId: '01400943' });

      // Should only have 3 calls: 1 token + 2 searches
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch.mock.calls[0][0]).toContain('/token');
      expect(mockFetch.mock.calls[1][0]).toContain('/products');
      expect(mockFetch.mock.calls[2][0]).toContain('/products');
    });
  });
});
