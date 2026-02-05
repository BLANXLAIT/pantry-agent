/**
 * Kroger API Client
 * Low-level HTTP client with OAuth2 authentication
 * Supports both direct Kroger API calls and Firebase Functions proxy
 */

import type { TokenResponse, APIError } from './types.js';

export interface KrogerClientConfigDirect {
  clientId: string;
  clientSecret: string;
  environment: 'certification' | 'production';
}

export interface KrogerClientConfigProxy {
  firebaseFunctionsUrl: string;
  environment: 'certification' | 'production';
}

export type KrogerClientConfig = KrogerClientConfigDirect | KrogerClientConfigProxy;

function isProxyConfig(config: KrogerClientConfig): config is KrogerClientConfigProxy {
  return 'firebaseFunctionsUrl' in config;
}

/**
 * Build Firebase v2 function URL
 * Firebase v2 functions have URLs like: https://{function}-{hash}-{region}.a.run.app
 * Given base URL https://xcf2umzgsq-uc.a.run.app, constructs https://authstart-xcf2umzgsq-uc.a.run.app
 */
function buildFunctionUrl(baseUrl: string, functionName: string): string {
  const url = new URL(baseUrl);
  // Insert function name as prefix to the hostname
  url.hostname = `${functionName}-${url.hostname}`;
  return url.origin;
}

export class KrogerClient {
  private readonly baseUrl: string;
  private readonly proxyUrl: string | null;
  private readonly clientId: string | null;
  private readonly clientSecret: string | null;

  constructor(config: KrogerClientConfig) {
    const host = config.environment === 'production' ? 'api.kroger.com' : 'api-ce.kroger.com';

    this.baseUrl = `https://${host}/v1`;

    if (isProxyConfig(config)) {
      // Firebase Functions proxy mode
      this.proxyUrl = config.firebaseFunctionsUrl;
      this.clientId = null;
      this.clientSecret = null;
    } else {
      // Direct Kroger API mode
      this.proxyUrl = null;
      this.clientId = config.clientId;
      this.clientSecret = config.clientSecret;
    }
  }

  /**
   * Get base64-encoded client credentials (direct mode only)
   */
  private getBasicAuth(): string {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Direct credentials not configured');
    }
    const credentials = `${this.clientId}:${this.clientSecret}`;
    return Buffer.from(credentials).toString('base64');
  }

  /**
   * Internal helper for token requests - handles both proxy and direct modes
   */
  private async fetchToken(
    proxyFunction: string,
    proxyBody: Record<string, string>,
    directParams: Record<string, string>,
    errorPrefix: string
  ): Promise<TokenResponse> {
    if (this.proxyUrl) {
      const url = buildFunctionUrl(this.proxyUrl, proxyFunction);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proxyBody),
      });

      if (!response.ok) {
        const error = (await response.json()) as APIError;
        throw new Error(
          `${errorPrefix}: ${error.error_description || error.error || response.statusText}`
        );
      }

      return response.json() as Promise<TokenResponse>;
    }

    const response = await fetch(`${this.baseUrl}/connect/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${this.getBasicAuth()}`,
      },
      body: new URLSearchParams(directParams).toString(),
    });

    if (!response.ok) {
      const error = (await response.json()) as APIError;
      throw new Error(
        `${errorPrefix}: ${error.error_description || error.reason || response.statusText}`
      );
    }

    return response.json() as Promise<TokenResponse>;
  }

  /**
   * Get access token using client credentials grant
   */
  async getClientToken(scope?: string): Promise<TokenResponse> {
    return this.fetchToken(
      'authclienttoken',
      { scope: scope || 'product.compact' },
      { grant_type: 'client_credentials', ...(scope && { scope }) },
      'Token request failed'
    );
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
    return this.fetchToken(
      'authtoken',
      { code, redirect_uri: redirectUri },
      { grant_type: 'authorization_code', code, redirect_uri: redirectUri },
      'Code exchange failed'
    );
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    return this.fetchToken(
      'authrefresh',
      { refresh_token: refreshToken },
      { grant_type: 'refresh_token', refresh_token: refreshToken },
      'Token refresh failed'
    );
  }

  /**
   * Build authorization URL for user consent
   * Uses Firebase proxy authStart endpoint when in proxy mode
   */
  getAuthorizationUrl(redirectUri: string, scope: string, state?: string): string {
    if (this.proxyUrl) {
      // Use Firebase Functions proxy
      const params = new URLSearchParams({
        redirect_uri: redirectUri,
        ...(state && { state }),
      });
      const baseUrl = buildFunctionUrl(this.proxyUrl, 'authstart');
      return `${baseUrl}?${params.toString()}`;
    }

    // Direct Kroger auth URL
    const params = new URLSearchParams({
      client_id: this.clientId!,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      ...(state && { state }),
    });

    return `${this.baseUrl}/connect/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Make an authenticated API request to Kroger
   * (Always goes direct to Kroger, using the access token)
   */
  async request<T>(path: string, accessToken: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
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
        const error = (await response.json()) as APIError;
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
