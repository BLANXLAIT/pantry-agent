/**
 * Kroger API Client
 * Low-level HTTP client with OAuth2 authentication
 */

import type { TokenResponse, APIError } from './types.js';

export interface KrogerClientConfig {
  clientId: string;
  clientSecret: string;
  environment: 'certification' | 'production';
}

export class KrogerClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly authUrl: string;

  constructor(config: KrogerClientConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;

    const host = config.environment === 'production'
      ? 'api.kroger.com'
      : 'api-ce.kroger.com';

    this.baseUrl = `https://${host}/v1`;
    this.authUrl = `https://${host}/v1/connect/oauth2`;
  }

  /**
   * Get base64-encoded client credentials
   */
  private getBasicAuth(): string {
    const credentials = `${this.clientId}:${this.clientSecret}`;
    return Buffer.from(credentials).toString('base64');
  }

  /**
   * Get access token using client credentials grant
   */
  async getClientToken(scope?: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      ...(scope && { scope }),
    });

    const response = await fetch(`${this.authUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${this.getBasicAuth()}`,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.json() as APIError;
      throw new Error(`Token request failed: ${error.error_description || error.reason || response.statusText}`);
    }

    return response.json() as Promise<TokenResponse>;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(`${this.authUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${this.getBasicAuth()}`,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.json() as APIError;
      throw new Error(`Code exchange failed: ${error.error_description || error.reason || response.statusText}`);
    }

    return response.json() as Promise<TokenResponse>;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const response = await fetch(`${this.authUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${this.getBasicAuth()}`,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.json() as APIError;
      throw new Error(`Token refresh failed: ${error.error_description || error.reason || response.statusText}`);
    }

    return response.json() as Promise<TokenResponse>;
  }

  /**
   * Build authorization URL for user consent
   */
  getAuthorizationUrl(redirectUri: string, scope: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      ...(state && { state }),
    });

    return `${this.authUrl}/authorize?${params.toString()}`;
  }

  /**
   * Make an authenticated API request
   */
  async request<T>(
    path: string,
    accessToken: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token expired or invalid');
      }
      if (response.status === 403) {
        throw new Error('Missing required scope');
      }

      let errorMessage = response.statusText;
      try {
        const error = await response.json() as APIError;
        errorMessage = error.error_description || error.reason || errorMessage;
      } catch {
        // Ignore JSON parse errors
      }
      throw new Error(`API request failed: ${errorMessage}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}
