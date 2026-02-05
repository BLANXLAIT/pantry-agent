/**
 * Tests for CartAPI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CartAPI } from './cart.js';
import type { KrogerClient } from './client.js';
import type { CartItem } from './types.js';

const createMockClient = () => ({
  request: vi.fn(),
});

describe('CartAPI', () => {
  let api: CartAPI;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    api = new CartAPI(mockClient as unknown as KrogerClient);
  });

  describe('addItems', () => {
    it('should add items to cart', async () => {
      mockClient.request.mockResolvedValueOnce(undefined);

      const items: CartItem[] = [
        { upc: '0001111041700', quantity: 2 },
        { upc: '0001111041701', quantity: 1 },
      ];

      await api.addItems(items, 'access-token');

      expect(mockClient.request).toHaveBeenCalledWith('/cart/add', 'access-token', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      });
    });

    it('should add single item to cart', async () => {
      mockClient.request.mockResolvedValueOnce(undefined);

      const items: CartItem[] = [{ upc: '0001111041700', quantity: 1 }];

      await api.addItems(items, 'access-token');

      expect(mockClient.request).toHaveBeenCalledWith(
        '/cart/add',
        'access-token',
        expect.objectContaining({
          body: JSON.stringify({ items }),
        })
      );
    });

    it('should include modality when provided', async () => {
      mockClient.request.mockResolvedValueOnce(undefined);

      const items: CartItem[] = [
        { upc: '0001111041700', quantity: 2, modality: 'PICKUP' },
        { upc: '0001111041701', quantity: 1, modality: 'DELIVERY' },
      ];

      await api.addItems(items, 'access-token');

      const call = mockClient.request.mock.calls[0];
      const body = JSON.parse(call[2]?.body as string);
      expect(body.items[0].modality).toBe('PICKUP');
      expect(body.items[1].modality).toBe('DELIVERY');
    });

    it('should handle empty items array', async () => {
      mockClient.request.mockResolvedValueOnce(undefined);

      await api.addItems([], 'access-token');

      expect(mockClient.request).toHaveBeenCalledWith(
        '/cart/add',
        'access-token',
        expect.objectContaining({
          body: '{"items":[]}',
        })
      );
    });

    it('should propagate authentication errors', async () => {
      mockClient.request.mockRejectedValueOnce(new Error('Token expired or invalid'));

      const items: CartItem[] = [{ upc: '0001111041700', quantity: 1 }];

      await expect(api.addItems(items, 'expired-token')).rejects.toThrow(
        'Token expired or invalid'
      );
    });

    it('should propagate scope errors', async () => {
      mockClient.request.mockRejectedValueOnce(new Error('Missing required scope'));

      const items: CartItem[] = [{ upc: '0001111041700', quantity: 1 }];

      await expect(api.addItems(items, 'token-without-cart-scope')).rejects.toThrow(
        'Missing required scope'
      );
    });

    it('should handle API errors', async () => {
      mockClient.request.mockRejectedValueOnce(new Error('API request failed: Invalid UPC'));

      const items: CartItem[] = [{ upc: 'invalid-upc', quantity: 1 }];

      await expect(api.addItems(items, 'access-token')).rejects.toThrow(
        'API request failed: Invalid UPC'
      );
    });
  });
});
