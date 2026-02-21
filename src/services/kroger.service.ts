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
  type ProductsResponse,
  type Location,
  type LocationsResponse,
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
  start?: number;
  brand?: string;
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
    const response = await this.searchProductsPage(options);
    return response.data;
  }

  /**
   * Search for products with pagination metadata.
   */
  async searchProductsPage(options: SearchProductsOptions): Promise<ProductsResponse> {
    const token = await this.auth.getAppToken(SCOPE_PRODUCTS);
    return this.products.search(
      {
        term: options.term,
        locationId: options.locationId,
        limit: options.limit ?? 10,
        start: options.start,
        brand: options.brand,
      },
      token
    );
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
    const response = await this.findStoresPage(options);
    return response.data;
  }

  /**
   * Find stores with pagination metadata.
   */
  async findStoresPage(options: FindStoresOptions): Promise<LocationsResponse> {
    // Locations API doesn't require a special scope
    const token = await this.auth.getAppToken('');
    return this.locations.find(
      {
        zipCode: options.zipCode,
        limit: options.limit ?? 5,
      },
      token
    );
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
   * Check if auth flow is in progress
   */
  isAuthInProgress(): boolean {
    return this.auth.isAuthInProgress();
  }

  /**
   * Start OAuth flow - opens browser for user login.
   * Returns the authorization URL so agents can present it to users.
   */
  async startAuthFlow(): Promise<{ authUrl: string }> {
    return this.auth.startAuthFlow(SCOPE_USER);
  }

  /**
   * Add items to user's cart
   * Requires user authentication. Throws AUTH_REQUIRED if not authenticated —
   * call startAuthFlow (or the kroger_start_auth MCP tool) to begin the login flow.
   */
  async addToCart(options: AddToCartOptions): Promise<void> {
    const token = await this.auth.getUserToken();
    if (!token) {
      throw new Error('AUTH_REQUIRED');
    }

    await this.cart.addItems(options.items, token);
  }

  /**
   * Get user profile
   * Requires user authentication. Throws AUTH_REQUIRED if not authenticated —
   * call startAuthFlow (or the kroger_start_auth MCP tool) to begin the login flow.
   */
  async getProfile(): Promise<Profile> {
    const token = await this.auth.getUserToken();
    if (!token) {
      throw new Error('AUTH_REQUIRED');
    }

    return this.identity.getProfile(token);
  }
}
