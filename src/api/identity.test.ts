/**
 * Tests for IdentityAPI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdentityAPI } from './identity.js';
import type { KrogerClient } from './client.js';
import type { Profile } from './types.js';

const createMockClient = () => ({
  request: vi.fn(),
});

describe('IdentityAPI', () => {
  let api: IdentityAPI;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    api = new IdentityAPI(mockClient as unknown as KrogerClient);
  });

  describe('getProfile', () => {
    it('should get user profile', async () => {
      const mockProfile: Profile = {
        id: 'user-123-abc',
      };

      mockClient.request.mockResolvedValueOnce({ data: mockProfile });

      const result = await api.getProfile('access-token');

      expect(result).toEqual(mockProfile);
      expect(mockClient.request).toHaveBeenCalledWith('/identity/profile', 'access-token');
    });

    it('should propagate authentication errors', async () => {
      mockClient.request.mockRejectedValueOnce(new Error('Token expired or invalid'));

      await expect(api.getProfile('expired-token')).rejects.toThrow(
        'Token expired or invalid'
      );
    });

    it('should propagate scope errors', async () => {
      mockClient.request.mockRejectedValueOnce(new Error('Missing required scope'));

      await expect(api.getProfile('token-without-profile-scope')).rejects.toThrow(
        'Missing required scope'
      );
    });

    it('should handle API errors', async () => {
      mockClient.request.mockRejectedValueOnce(
        new Error('API request failed: Server error')
      );

      await expect(api.getProfile('access-token')).rejects.toThrow(
        'API request failed: Server error'
      );
    });
  });
});
