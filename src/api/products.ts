/**
 * Kroger Products API
 */

import type { KrogerClient } from './client.js';
import type { Product, ProductsResponse } from './types.js';

export interface SearchProductsParams {
  term: string;
  locationId: string;
  limit?: number;
  start?: number;
  brand?: string;
}

export class ProductsAPI {
  constructor(private readonly client: KrogerClient) {}

  /**
   * Search for products
   * Requires scope: product.compact
   */
  async search(params: SearchProductsParams, accessToken: string): Promise<ProductsResponse> {
    const queryParams = new URLSearchParams({
      'filter.term': params.term,
      'filter.locationId': params.locationId,
      'filter.limit': String(params.limit ?? 10),
      ...(params.start && { 'filter.start': String(params.start) }),
      ...(params.brand && { 'filter.brand': params.brand }),
    });

    return this.client.request<ProductsResponse>(
      `/products?${queryParams.toString()}`,
      accessToken
    );
  }

  /**
   * Get product by ID
   * Requires scope: product.compact
   */
  async getById(productId: string, locationId: string, accessToken: string): Promise<Product> {
    const queryParams = new URLSearchParams({
      'filter.locationId': locationId,
    });

    const response = await this.client.request<ProductsResponse>(
      `/products/${productId}?${queryParams.toString()}`,
      accessToken
    );

    if (!response.data || response.data.length === 0) {
      throw new Error(`Product not found: ${productId}`);
    }

    return response.data[0];
  }
}
