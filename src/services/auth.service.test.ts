/**
 * Tests for AuthService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from './auth.service.js';
import type { KrogerClient } from '../api/client.js';
import type { StoredTokens, TokenResponse } from '../api/types.js';

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock os module
vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/mock/home'),
}));

// Import mocked fs after vi.mock
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const mockExistsSync = vi.mocked(existsSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);

const createMockClient = () => ({
  getClientToken: vi.fn(),
  exchangeCode: vi.fn(),
  refreshToken: vi.fn(),
  getAuthorizationUrl: vi.fn(),
});

describe('AuthService', () => {
  let service: AuthService;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    service = new AuthService(mockClient as unknown as KrogerClient);
    vi.clearAllMocks();

    // Reset mocks to default behavior
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAppToken', () => {
    it('should get new token when no cached token exists', async () => {
      const tokenResponse: TokenResponse = {
        access_token: 'app-token-123',
        token_type: 'bearer',
        expires_in: 1800,
      };

      mockClient.getClientToken.mockResolvedValueOnce(tokenResponse);

      const result = await service.getAppToken('product.compact');

      expect(result).toBe('app-token-123');
      expect(mockClient.getClientToken).toHaveBeenCalledWith('product.compact');
    });

    it('should return cached token when still valid', async () => {
      const tokenResponse: TokenResponse = {
        access_token: 'app-token-123',
        token_type: 'bearer',
        expires_in: 1800, // 30 minutes
      };

      mockClient.getClientToken.mockResolvedValueOnce(tokenResponse);

      // First call - gets new token
      const result1 = await service.getAppToken('product.compact');
      expect(result1).toBe('app-token-123');

      // Second call - should use cached token
      const result2 = await service.getAppToken('product.compact');
      expect(result2).toBe('app-token-123');

      // Should only call getClientToken once
      expect(mockClient.getClientToken).toHaveBeenCalledTimes(1);
    });

    it('should refresh token when approaching expiration', async () => {
      const tokenResponse1: TokenResponse = {
        access_token: 'old-token',
        token_type: 'bearer',
        expires_in: 60, // Only 1 minute until expiry - less than 5 min buffer
      };
      const tokenResponse2: TokenResponse = {
        access_token: 'new-token',
        token_type: 'bearer',
        expires_in: 1800,
      };

      mockClient.getClientToken
        .mockResolvedValueOnce(tokenResponse1)
        .mockResolvedValueOnce(tokenResponse2);

      // First call
      const result1 = await service.getAppToken('product.compact');
      expect(result1).toBe('old-token');

      // Second call - token is within buffer, should get new one
      const result2 = await service.getAppToken('product.compact');
      expect(result2).toBe('new-token');

      expect(mockClient.getClientToken).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStoredTokens', () => {
    it('should return null when tokens file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = service.getStoredTokens();

      expect(result).toBeNull();
    });

    it('should return stored tokens when file exists', () => {
      const storedTokens: StoredTokens = {
        accessToken: 'user-access-token',
        refreshToken: 'user-refresh-token',
        expiresAt: Date.now() + 1800000,
        scope: 'cart.basic:write profile.compact',
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(storedTokens));

      const result = service.getStoredTokens();

      expect(result).toEqual(storedTokens);
    });

    it('should return null when JSON parsing fails', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json');

      const result = service.getStoredTokens();

      expect(result).toBeNull();
    });

    it('should return null when file read fails', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = service.getStoredTokens();

      expect(result).toBeNull();
    });
  });

  describe('storeTokens', () => {
    it('should create config directory if it does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const tokens: StoredTokens = {
        accessToken: 'token',
        expiresAt: Date.now(),
        scope: 'product.compact',
      };

      service.storeTokens(tokens);

      expect(mockMkdirSync).toHaveBeenCalledWith('/mock/home/.pantry-agent', {
        recursive: true,
        mode: 0o700,
      });
    });

    it('should not create config directory if it already exists', () => {
      mockExistsSync.mockReturnValue(true);

      const tokens: StoredTokens = {
        accessToken: 'token',
        expiresAt: Date.now(),
        scope: 'product.compact',
      };

      service.storeTokens(tokens);

      expect(mockMkdirSync).not.toHaveBeenCalled();
    });

    it('should write tokens to file with secure permissions', () => {
      mockExistsSync.mockReturnValue(true);

      const tokens: StoredTokens = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: Date.now(),
        scope: 'cart.basic:write',
      };

      service.storeTokens(tokens);

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/mock/home/.pantry-agent/tokens.json',
        JSON.stringify(tokens, null, 2),
        { mode: 0o600 }
      );
    });
  });

  describe('clearTokens', () => {
    it('should clear tokens file when it exists', () => {
      mockExistsSync.mockReturnValue(true);

      service.clearTokens();

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/mock/home/.pantry-agent/tokens.json',
        '',
        { mode: 0o600 }
      );
    });

    it('should do nothing when tokens file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      service.clearTokens();

      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });

  describe('getUserToken', () => {
    it('should return null when no stored tokens exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await service.getUserToken();

      expect(result).toBeNull();
    });

    it('should return stored token when still valid', async () => {
      const storedTokens: StoredTokens = {
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 1800000, // 30 minutes from now
        scope: 'cart.basic:write',
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(storedTokens));

      const result = await service.getUserToken();

      expect(result).toBe('valid-token');
      expect(mockClient.refreshToken).not.toHaveBeenCalled();
    });

    it('should refresh token when approaching expiration', async () => {
      const storedTokens: StoredTokens = {
        accessToken: 'expiring-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 60000, // 1 minute from now (within 5 min buffer)
        scope: 'cart.basic:write',
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(storedTokens));

      const newTokenResponse: TokenResponse = {
        access_token: 'new-access-token',
        token_type: 'bearer',
        expires_in: 1800,
        refresh_token: 'new-refresh-token',
      };

      mockClient.refreshToken.mockResolvedValueOnce(newTokenResponse);

      const result = await service.getUserToken();

      expect(result).toBe('new-access-token');
      expect(mockClient.refreshToken).toHaveBeenCalledWith('refresh-token');
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should return null when no refresh token available and token expired', async () => {
      const storedTokens: StoredTokens = {
        accessToken: 'expired-token',
        // No refresh token
        expiresAt: Date.now() + 60000,
        scope: 'cart.basic:write',
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(storedTokens));

      const result = await service.getUserToken();

      expect(result).toBeNull();
      expect(mockClient.refreshToken).not.toHaveBeenCalled();
    });

    it('should clear tokens and return null when refresh fails', async () => {
      const storedTokens: StoredTokens = {
        accessToken: 'expired-token',
        refreshToken: 'invalid-refresh-token',
        expiresAt: Date.now() + 60000,
        scope: 'cart.basic:write',
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(storedTokens));

      mockClient.refreshToken.mockRejectedValueOnce(new Error('Refresh token expired'));

      const result = await service.getUserToken();

      expect(result).toBeNull();
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/mock/home/.pantry-agent/tokens.json',
        '',
        { mode: 0o600 }
      );
    });
  });

  describe('isUserAuthenticated', () => {
    it('should return true when valid user token exists', async () => {
      const storedTokens: StoredTokens = {
        accessToken: 'valid-token',
        expiresAt: Date.now() + 1800000,
        scope: 'cart.basic:write',
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(storedTokens));

      const result = await service.isUserAuthenticated();

      expect(result).toBe(true);
    });

    it('should return false when no user token exists', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await service.isUserAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe('handleCallback', () => {
    it('should exchange code for tokens and store them', async () => {
      const tokenResponse: TokenResponse = {
        access_token: 'new-access-token',
        token_type: 'bearer',
        expires_in: 1800,
        refresh_token: 'new-refresh-token',
      };

      mockClient.exchangeCode.mockResolvedValueOnce(tokenResponse);
      mockExistsSync.mockReturnValue(true);

      await service.handleCallback(
        'auth-code-123',
        'http://localhost/callback',
        'cart.basic:write profile.compact'
      );

      expect(mockClient.exchangeCode).toHaveBeenCalledWith(
        'auth-code-123',
        'http://localhost/callback'
      );

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/mock/home/.pantry-agent/tokens.json',
        expect.stringContaining('new-access-token'),
        { mode: 0o600 }
      );

      // Verify stored tokens structure
      const storedData = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(storedData).toMatchObject({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        scope: 'cart.basic:write profile.compact',
      });
      expect(storedData.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should propagate errors from code exchange', async () => {
      mockClient.exchangeCode.mockRejectedValueOnce(
        new Error('Code exchange failed: Invalid authorization code')
      );

      await expect(
        service.handleCallback('invalid-code', 'http://localhost/callback', 'scope')
      ).rejects.toThrow('Code exchange failed: Invalid authorization code');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should delegate to client getAuthorizationUrl', () => {
      mockClient.getAuthorizationUrl.mockReturnValue(
        'https://api-ce.kroger.com/v1/connect/oauth2/authorize?client_id=...'
      );

      const result = service.getAuthorizationUrl(
        'http://localhost/callback',
        'cart.basic:write profile.compact'
      );

      expect(mockClient.getAuthorizationUrl).toHaveBeenCalledWith(
        'http://localhost/callback',
        'cart.basic:write profile.compact'
      );
      expect(result).toBe('https://api-ce.kroger.com/v1/connect/oauth2/authorize?client_id=...');
    });
  });
});
