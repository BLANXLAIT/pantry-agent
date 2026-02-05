/**
 * Kroger Service
 * High-level business logic layer wrapping API client
 */

import {
  KrogerClient,
  ProductsAPI,
  LocationsAPI,
  CartAPI,
  IdentityAPI,
  type KrogerClientConfig,
  type Product,
  type Location,
  type CartItem,
  type Profile,
} from '../api/index.js';
import { AuthService } from './auth.service.js';

// Scopes
const SCOPE_PRODUCTS = 'product.compact';
const SCOPE_CART = 'cart.basic:write';
const SCOPE_PROFILE = 'profile.compact';
const SCOPE_USER = `${SCOPE_CART} ${SCOPE_PROFILE}`;

export interface SearchProductsOptions {
  term: string;
  locationId: string;
  limit?: number;
}

export interface FindStoresOptions {
  zipCode: string;
  limit?: number;
}

export interface AddToCartOptions {
  items: CartItem[];
}

export class KrogerService {
  private readonly client: KrogerClient;
  private readonly auth: AuthService;
  private readonly products: ProductsAPI;
  private readonly locations: LocationsAPI;
  private readonly cart: CartAPI;
  private readonly identity: IdentityAPI;

  constructor(config: KrogerClientConfig) {
    this.client = new KrogerClient(config);
    this.auth = new AuthService(this.client);
    this.products = new ProductsAPI(this.client);
    this.locations = new LocationsAPI(this.client);
    this.cart = new CartAPI(this.client);
    this.identity = new IdentityAPI(this.client);
  }

  /**
   * Get auth service for CLI commands
   */
  getAuthService(): AuthService {
    return this.auth;
  }

  /**
   * Get user auth scope
   */
  getUserScope(): string {
    return SCOPE_USER;
  }

  // ============ App-level operations (no user auth required) ============

  /**
   * Search for products at a store
   */
  async searchProducts(options: SearchProductsOptions): Promise<Product[]> {
    const token = await this.auth.getAppToken(SCOPE_PRODUCTS);
    const response = await this.products.search(
      {
        term: options.term,
        locationId: options.locationId,
        limit: options.limit ?? 10,
      },
      token
    );
    return response.data;
  }

  /**
   * Get product by ID
   */
  async getProduct(productId: string, locationId: string): Promise<Product> {
    const token = await this.auth.getAppToken(SCOPE_PRODUCTS);
    return this.products.getById(productId, locationId, token);
  }

  /**
   * Find stores near a ZIP code
   */
  async findStores(options: FindStoresOptions): Promise<Location[]> {
    // Locations API doesn't require a special scope
    const token = await this.auth.getAppToken('');
    const response = await this.locations.find(
      {
        zipCode: options.zipCode,
        limit: options.limit ?? 5,
      },
      token
    );
    return response.data;
  }

  /**
   * Get store details by ID
   */
  async getStore(locationId: string): Promise<Location> {
    const token = await this.auth.getAppToken('');
    return this.locations.getById(locationId, token);
  }

  // ============ User-level operations (requires user auth) ============

  /**
   * Check if user is authenticated
   */
  async isUserAuthenticated(): Promise<boolean> {
    return this.auth.isUserAuthenticated();
  }

  /**
   * Add items to user's cart
   * Requires user authentication
   */
  async addToCart(options: AddToCartOptions): Promise<void> {
    const token = await this.auth.getUserToken();
    if (!token) {
      throw new Error('User not authenticated. Run `pantry-agent auth` to log in.');
    }

    await this.cart.addItems(options.items, token);
  }

  /**
   * Get user profile
   * Requires user authentication
   */
  async getProfile(): Promise<Profile> {
    const token = await this.auth.getUserToken();
    if (!token) {
      throw new Error('User not authenticated. Run `pantry-agent auth` to log in.');
    }

    return this.identity.getProfile(token);
  }
}
