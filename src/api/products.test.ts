/**
 * Tests for ProductsAPI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductsAPI } from './products.js';
import type { KrogerClient } from './client.js';
import type { ProductsResponse, Product } from './types.js';

// Mock KrogerClient
const createMockClient = () => ({
  request: vi.fn(),
});

describe('ProductsAPI', () => {
  let api: ProductsAPI;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    api = new ProductsAPI(mockClient as unknown as KrogerClient);
  });

  describe('search', () => {
    const mockProductsResponse: ProductsResponse = {
      data: [
        {
          productId: '0001111041700',
          upc: '0001111041700',
          description: 'Kroger 2% Reduced Fat Milk',
          brand: 'Kroger',
          images: [],
          items: [
            {
              itemId: 'item-1',
              price: { regular: 3.99 },
              inventory: { stockLevel: 'HIGH' },
            },
          ],
        },
        {
          productId: '0001111041701',
          upc: '0001111041701',
          description: 'Kroger Whole Milk',
          brand: 'Kroger',
          images: [],
        },
      ],
      meta: {
        pagination: { start: 0, limit: 10, total: 2 },
      },
    };

    it('should search products with required parameters', async () => {
      mockClient.request.mockResolvedValueOnce(mockProductsResponse);

      const result = await api.search({ term: 'milk', locationId: '01400943' }, 'access-token');

      expect(result).toEqual(mockProductsResponse);
      expect(mockClient.request).toHaveBeenCalledWith(
        expect.stringContaining('/products?'),
        'access-token'
      );

      const url = mockClient.request.mock.calls[0][0] as string;
      expect(url).toContain('filter.term=milk');
      expect(url).toContain('filter.locationId=01400943');
      expect(url).toContain('filter.limit=10');
    });

    it('should use custom limit when provided', async () => {
      mockClient.request.mockResolvedValueOnce(mockProductsResponse);

      await api.search({ term: 'eggs', locationId: '01400943', limit: 25 }, 'access-token');

      const url = mockClient.request.mock.calls[0][0] as string;
      expect(url).toContain('filter.limit=25');
    });

    it('should include start parameter for pagination', async () => {
      mockClient.request.mockResolvedValueOnce(mockProductsResponse);

      await api.search({ term: 'bread', locationId: '01400943', start: 20 }, 'access-token');

      const url = mockClient.request.mock.calls[0][0] as string;
      expect(url).toContain('filter.start=20');
    });

    it('should include brand filter when provided', async () => {
      mockClient.request.mockResolvedValueOnce(mockProductsResponse);

      await api.search(
        { term: 'cereal', locationId: '01400943', brand: 'Kellogg' },
        'access-token'
      );

      const url = mockClient.request.mock.calls[0][0] as string;
      expect(url).toContain('filter.brand=Kellogg');
    });

    it('should not include optional parameters when not provided', async () => {
      mockClient.request.mockResolvedValueOnce(mockProductsResponse);

      await api.search({ term: 'butter', locationId: '01400943' }, 'access-token');

      const url = mockClient.request.mock.calls[0][0] as string;
      expect(url).not.toContain('filter.start=');
      expect(url).not.toContain('filter.brand=');
    });

    it('should propagate client errors', async () => {
      mockClient.request.mockRejectedValueOnce(new Error('Token expired or invalid'));

      await expect(
        api.search({ term: 'milk', locationId: '01400943' }, 'expired-token')
      ).rejects.toThrow('Token expired or invalid');
    });
  });

  describe('getById', () => {
    const mockProduct: Product = {
      productId: '0001111041700',
      upc: '0001111041700',
      description: 'Kroger 2% Reduced Fat Milk',
      brand: 'Kroger',
      categories: ['Dairy', 'Milk'],
      images: [
        {
          perspective: 'front',
          featured: true,
          sizes: [{ size: 'medium', url: 'https://example.com/image.jpg' }],
        },
      ],
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
      aisleLocations: [
        {
          description: 'Dairy',
          number: '12',
        },
      ],
    };

    it('should get product by ID', async () => {
      mockClient.request.mockResolvedValueOnce({ data: [mockProduct] });

      const result = await api.getById('0001111041700', '01400943', 'access-token');

      expect(result).toEqual(mockProduct);
      expect(mockClient.request).toHaveBeenCalledWith(
        '/products/0001111041700?filter.locationId=01400943',
        'access-token'
      );
    });

    it('should throw error when product not found', async () => {
      mockClient.request.mockResolvedValueOnce({ data: [] });

      await expect(api.getById('nonexistent-product', '01400943', 'access-token')).rejects.toThrow(
        'Product not found: nonexistent-product'
      );
    });

    it('should throw error when data is undefined', async () => {
      mockClient.request.mockResolvedValueOnce({ data: undefined });

      await expect(api.getById('product-123', '01400943', 'access-token')).rejects.toThrow(
        'Product not found: product-123'
      );
    });

    it('should propagate client errors', async () => {
      mockClient.request.mockRejectedValueOnce(new Error('API request failed: Not Found'));

      await expect(api.getById('invalid-id', '01400943', 'access-token')).rejects.toThrow(
        'API request failed: Not Found'
      );
    });
  });
});
