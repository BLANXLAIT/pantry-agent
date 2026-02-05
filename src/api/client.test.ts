/**
 * Tests for KrogerClient
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KrogerClient, type KrogerClientConfig } from './client.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('KrogerClient', () => {
  let client: KrogerClient;
  const config: KrogerClientConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    environment: 'certification',
  };

  beforeEach(() => {
    client = new KrogerClient(config);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use certification API URL for certification environment', () => {
      const certClient = new KrogerClient({ ...config, environment: 'certification' });
      const authUrl = certClient.getAuthorizationUrl('http://localhost', 'product.compact');
      expect(authUrl).toContain('api-ce.kroger.com');
    });

    it('should use production API URL for production environment', () => {
      const prodClient = new KrogerClient({ ...config, environment: 'production' });
      const authUrl = prodClient.getAuthorizationUrl('http://localhost', 'product.compact');
      expect(authUrl).toContain('api.kroger.com');
    });
  });

  describe('getClientToken', () => {
    it('should return token response on success', async () => {
      const tokenResponse = {
        access_token: 'test-access-token',
        token_type: 'bearer',
        expires_in: 1800,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tokenResponse),
      });

      const result = await client.getClientToken('product.compact');

      expect(result).toEqual(tokenResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api-ce.kroger.com/v1/connect/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': expect.stringMatching(/^Basic /),
          }),
        })
      );
    });

    it('should include scope in request body when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token', token_type: 'bearer', expires_in: 1800 }),
      });

      await client.getClientToken('product.compact');

      const call = mockFetch.mock.calls[0];
      const body = call[1]?.body as string;
      expect(body).toContain('scope=product.compact');
      expect(body).toContain('grant_type=client_credentials');
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error_description: 'Invalid client credentials' }),
      });

      await expect(client.getClientToken('product.compact')).rejects.toThrow(
        'Token request failed: Invalid client credentials'
      );
    });

    it('should use reason field when error_description is not available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ reason: 'Bad credentials' }),
      });

      await expect(client.getClientToken()).rejects.toThrow('Token request failed: Bad credentials');
    });

    it('should use statusText as fallback error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Service Unavailable',
        json: () => Promise.resolve({}),
      });

      await expect(client.getClientToken()).rejects.toThrow('Token request failed: Service Unavailable');
    });
  });

  describe('exchangeCode', () => {
    it('should exchange authorization code for tokens', async () => {
      const tokenResponse = {
        access_token: 'access-token',
        token_type: 'bearer',
        expires_in: 1800,
        refresh_token: 'refresh-token',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tokenResponse),
      });

      const result = await client.exchangeCode('auth-code-123', 'http://localhost/callback');

      expect(result).toEqual(tokenResponse);

      const call = mockFetch.mock.calls[0];
      const body = call[1]?.body as string;
      expect(body).toContain('grant_type=authorization_code');
      expect(body).toContain('code=auth-code-123');
      expect(body).toContain('redirect_uri=http%3A%2F%2Flocalhost%2Fcallback');
    });

    it('should throw error on code exchange failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error_description: 'Invalid authorization code' }),
      });

      await expect(client.exchangeCode('invalid-code', 'http://localhost/callback')).rejects.toThrow(
        'Code exchange failed: Invalid authorization code'
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh access token using refresh token', async () => {
      const tokenResponse = {
        access_token: 'new-access-token',
        token_type: 'bearer',
        expires_in: 1800,
        refresh_token: 'new-refresh-token',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tokenResponse),
      });

      const result = await client.refreshToken('old-refresh-token');

      expect(result).toEqual(tokenResponse);

      const call = mockFetch.mock.calls[0];
      const body = call[1]?.body as string;
      expect(body).toContain('grant_type=refresh_token');
      expect(body).toContain('refresh_token=old-refresh-token');
    });

    it('should throw error when refresh token is expired', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error_description: 'Refresh token expired' }),
      });

      await expect(client.refreshToken('expired-token')).rejects.toThrow(
        'Token refresh failed: Refresh token expired'
      );
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should build correct authorization URL', () => {
      const url = client.getAuthorizationUrl(
        'http://localhost:3000/callback',
        'cart.basic:write profile.compact'
      );

      expect(url).toContain('https://api-ce.kroger.com/v1/connect/oauth2/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=cart.basic%3Awrite+profile.compact');
    });

    it('should include state parameter when provided', () => {
      const url = client.getAuthorizationUrl(
        'http://localhost/callback',
        'product.compact',
        'random-state-123'
      );

      expect(url).toContain('state=random-state-123');
    });

    it('should not include state parameter when not provided', () => {
      const url = client.getAuthorizationUrl('http://localhost/callback', 'product.compact');

      expect(url).not.toContain('state=');
    });
  });

  describe('request', () => {
    it('should make authenticated API request', async () => {
      const responseData = { data: [{ id: '123', name: 'Test Product' }] };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responseData),
      });

      const result = await client.request('/products?filter.term=milk', 'access-token-123');

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api-ce.kroger.com/v1/products?filter.term=milk',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'Authorization': 'Bearer access-token-123',
          }),
        })
      );
    });

    it('should handle 204 No Content response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await client.request('/cart/add', 'token', { method: 'PUT' });

      expect(result).toBeUndefined();
    });

    it('should throw specific error for 401 Unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: 'Token expired' }),
      });

      await expect(client.request('/products', 'expired-token')).rejects.toThrow(
        'Token expired or invalid'
      );
    });

    it('should throw specific error for 403 Forbidden', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ error: 'Insufficient scope' }),
      });

      await expect(client.request('/cart/add', 'token')).rejects.toThrow(
        'Missing required scope'
      );
    });

    it('should handle other API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error_description: 'Server error occurred' }),
      });

      await expect(client.request('/products', 'token')).rejects.toThrow(
        'API request failed: Server error occurred'
      );
    });

    it('should use statusText when JSON parsing fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(client.request('/products', 'token')).rejects.toThrow(
        'API request failed: Internal Server Error'
      );
    });

    it('should merge custom headers with default headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
      });

      await client.request('/cart/add', 'token', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: [] }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'Authorization': 'Bearer token',
            'Content-Type': 'application/json',
          }),
          body: '{"items":[]}',
        })
      );
    });
  });
});
