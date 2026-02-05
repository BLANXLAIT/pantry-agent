/**
 * Kroger Cart API
 */

import type { KrogerClient } from './client.js';
import type { CartItem, CartAddRequest } from './types.js';

export class CartAPI {
  constructor(private readonly client: KrogerClient) {}

  /**
   * Add items to cart
   * Requires scope: cart.basic:write
   * Requires user authentication (authorization code grant)
   */
  async addItems(
    items: CartItem[],
    accessToken: string
  ): Promise<void> {
    const body: CartAddRequest = { items };

    await this.client.request<void>(
      '/cart/add',
      accessToken,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
  }
}
