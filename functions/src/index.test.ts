/**
 * Tests for Firebase Functions (OAuth endpoints)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock firebase-functions before importing the functions
vi.mock('firebase-functions/v2/https', () => ({
  onRequest: vi.fn((optionsOrHandler, handler?) => {
    // If first arg is a function, it's the handler (no options)
    // If first arg is options object, second arg is handler
    const actualHandler = handler ?? optionsOrHandler;
    return actualHandler;
  }),
}));

vi.mock('firebase-functions/params', () => ({
  defineSecret: vi.fn((name: string) => ({
    value: () => {
      if (name === 'KROGER_CLIENT_ID') return 'mock-client-id';
      if (name === 'KROGER_CLIENT_SECRET') return 'mock-client-secret';
      return '';
    },
  })),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import the module after mocking
import { authStart, authToken, authRefresh, authClientToken } from './index.js';

// Helper to create mock request
const createMockRequest = (options: {
  method?: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
}) => ({
  method: options.method ?? 'GET',
  query: options.query ?? {},
  body: options.body ?? {},
});

// Helper to create mock response
const createMockResponse = () => {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return res;
};

describe('Firebase Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('authStart', () => {
    it('should handle CORS preflight request', async () => {
      const req = createMockRequest({ method: 'OPTIONS' });
      const res = createMockResponse();

      await (authStart as any)(req, res);

      expect(res.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(res.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET');
      expect(res.set).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalledWith('');
    });

    it('should return error when redirect_uri is missing', async () => {
      const req = createMockRequest({ method: 'GET', query: {} });
      const res = createMockResponse();

      await (authStart as any)(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'redirect_uri is required' });
    });

    it('should redirect to Kroger authorization URL', async () => {
      const req = createMockRequest({
        method: 'GET',
        query: { redirect_uri: 'http://localhost:3000/callback' },
      });
      const res = createMockResponse();

      await (authStart as any)(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('https://api-ce.kroger.com/v1/connect/oauth2/authorize')
      );
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('client_id=mock-client-id')
      );
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback')
      );
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('response_type=code'));
    });

    it('should include state parameter when provided', async () => {
      const req = createMockRequest({
        method: 'GET',
        query: {
          redirect_uri: 'http://localhost:3000/callback',
          state: 'random-state-123',
        },
      });
      const res = createMockResponse();

      await (authStart as any)(req, res);

      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('state=random-state-123'));
    });
  });

  describe('authToken', () => {
    it('should handle CORS preflight request', async () => {
      const req = createMockRequest({ method: 'OPTIONS' });
      const res = createMockResponse();

      await (authToken as any)(req, res);

      expect(res.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(res.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'POST');
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should return 405 for non-POST requests', async () => {
      const req = createMockRequest({ method: 'GET' });
      const res = createMockResponse();

      await (authToken as any)(req, res);

      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
    });

    it('should return error when code is missing', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: { redirect_uri: 'http://localhost/callback' },
      });
      const res = createMockResponse();

      await (authToken as any)(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'code and redirect_uri are required' });
    });

    it('should return error when redirect_uri is missing', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: { code: 'auth-code-123' },
      });
      const res = createMockResponse();

      await (authToken as any)(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'code and redirect_uri are required' });
    });

    it('should exchange code for tokens successfully', async () => {
      const tokenResponse = {
        access_token: 'access-token-123',
        token_type: 'bearer',
        expires_in: 1800,
        refresh_token: 'refresh-token-123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tokenResponse),
      });

      const req = createMockRequest({
        method: 'POST',
        body: {
          code: 'auth-code-123',
          redirect_uri: 'http://localhost/callback',
        },
      });
      const res = createMockResponse();

      await (authToken as any)(req, res);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api-ce.kroger.com/v1/connect/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      );
      expect(res.json).toHaveBeenCalledWith(tokenResponse);
    });

    it('should forward Kroger API errors', async () => {
      const errorResponse = {
        error: 'invalid_grant',
        error_description: 'Authorization code expired',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(errorResponse),
      });

      const req = createMockRequest({
        method: 'POST',
        body: {
          code: 'expired-code',
          redirect_uri: 'http://localhost/callback',
        },
      });
      const res = createMockResponse();

      await (authToken as any)(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(errorResponse);
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const req = createMockRequest({
        method: 'POST',
        body: {
          code: 'auth-code-123',
          redirect_uri: 'http://localhost/callback',
        },
      });
      const res = createMockResponse();

      await (authToken as any)(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to exchange code for tokens' });
    });
  });

  describe('authRefresh', () => {
    it('should handle CORS preflight request', async () => {
      const req = createMockRequest({ method: 'OPTIONS' });
      const res = createMockResponse();

      await (authRefresh as any)(req, res);

      expect(res.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should return 405 for non-POST requests', async () => {
      const req = createMockRequest({ method: 'GET' });
      const res = createMockResponse();

      await (authRefresh as any)(req, res);

      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
    });

    it('should return error when refresh_token is missing', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: {},
      });
      const res = createMockResponse();

      await (authRefresh as any)(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'refresh_token is required' });
    });

    it('should refresh tokens successfully', async () => {
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

      const req = createMockRequest({
        method: 'POST',
        body: { refresh_token: 'old-refresh-token' },
      });
      const res = createMockResponse();

      await (authRefresh as any)(req, res);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api-ce.kroger.com/v1/connect/oauth2/token',
        expect.objectContaining({
          method: 'POST',
        })
      );

      const call = mockFetch.mock.calls[0];
      const body = call[1]?.body as string;
      expect(body).toContain('grant_type=refresh_token');
      expect(body).toContain('refresh_token=old-refresh-token');

      expect(res.json).toHaveBeenCalledWith(tokenResponse);
    });

    it('should forward Kroger API errors', async () => {
      const errorResponse = {
        error: 'invalid_grant',
        error_description: 'Refresh token expired',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(errorResponse),
      });

      const req = createMockRequest({
        method: 'POST',
        body: { refresh_token: 'expired-refresh-token' },
      });
      const res = createMockResponse();

      await (authRefresh as any)(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(errorResponse);
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const req = createMockRequest({
        method: 'POST',
        body: { refresh_token: 'refresh-token' },
      });
      const res = createMockResponse();

      await (authRefresh as any)(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to refresh token' });
    });
  });

  describe('authClientToken', () => {
    it('should handle CORS preflight request', async () => {
      const req = createMockRequest({ method: 'OPTIONS' });
      const res = createMockResponse();

      await (authClientToken as any)(req, res);

      expect(res.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should return 405 for non-POST requests', async () => {
      const req = createMockRequest({ method: 'GET' });
      const res = createMockResponse();

      await (authClientToken as any)(req, res);

      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
    });

    it('should get client token with default scope', async () => {
      const tokenResponse = {
        access_token: 'client-token-123',
        token_type: 'bearer',
        expires_in: 1800,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tokenResponse),
      });

      const req = createMockRequest({
        method: 'POST',
        body: {},
      });
      const res = createMockResponse();

      await (authClientToken as any)(req, res);

      const call = mockFetch.mock.calls[0];
      const body = call[1]?.body as string;
      expect(body).toContain('grant_type=client_credentials');
      expect(body).toContain('scope=product.compact');

      expect(res.json).toHaveBeenCalledWith(tokenResponse);
    });

    it('should get client token with custom scope', async () => {
      const tokenResponse = {
        access_token: 'client-token-123',
        token_type: 'bearer',
        expires_in: 1800,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tokenResponse),
      });

      const req = createMockRequest({
        method: 'POST',
        body: { scope: 'cart.basic:write' },
      });
      const res = createMockResponse();

      await (authClientToken as any)(req, res);

      const call = mockFetch.mock.calls[0];
      const body = call[1]?.body as string;
      expect(body).toContain('scope=cart.basic%3Awrite');

      expect(res.json).toHaveBeenCalledWith(tokenResponse);
    });

    it('should forward Kroger API errors', async () => {
      const errorResponse = {
        error: 'invalid_client',
        error_description: 'Invalid client credentials',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve(errorResponse),
      });

      const req = createMockRequest({
        method: 'POST',
        body: {},
      });
      const res = createMockResponse();

      await (authClientToken as any)(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(errorResponse);
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const req = createMockRequest({
        method: 'POST',
        body: {},
      });
      const res = createMockResponse();

      await (authClientToken as any)(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to get client token' });
    });
  });
});
