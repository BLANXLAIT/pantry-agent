/**
 * Tests for MCP Resources
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getResourcesHandler, readResourceHandler } from './resources.js';
import type { KrogerService } from '../services/kroger.service.js';
import type { ReadResourceRequest } from '@modelcontextprotocol/sdk/types.js';

const createMockKrogerService = () => ({
  isUserAuthenticated: vi.fn(),
  searchProducts: vi.fn(),
  getProduct: vi.fn(),
  findStores: vi.fn(),
  getStore: vi.fn(),
  addToCart: vi.fn(),
  getProfile: vi.fn(),
  getAuthService: vi.fn(),
  getUserScope: vi.fn(),
});

describe('MCP Resources', () => {
  let mockKroger: ReturnType<typeof createMockKrogerService>;

  beforeEach(() => {
    mockKroger = createMockKrogerService();
    vi.clearAllMocks();
  });

  describe('getResourcesHandler', () => {
    it('should return list of resources', async () => {
      const handler = getResourcesHandler();
      const result = await handler({} as any);

      expect(result.resources).toBeDefined();
      expect(result.resources.length).toBeGreaterThan(0);

      // Verify auth status resource exists
      const authResource = result.resources.find((r) => r.uri === 'kroger://auth/status');
      expect(authResource).toBeDefined();
      expect(authResource?.name).toBe('Authentication Status');
      expect(authResource?.mimeType).toBe('application/json');
    });
  });

  describe('readResourceHandler', () => {
    describe('kroger://auth/status', () => {
      it('should return authenticated status when user is authenticated', async () => {
        mockKroger.isUserAuthenticated.mockResolvedValueOnce(true);

        const handler = readResourceHandler(mockKroger as unknown as KrogerService);
        const request: ReadResourceRequest = {
          method: 'resources/read',
          params: {
            uri: 'kroger://auth/status',
          },
        };

        const result = await handler(request);

        expect(mockKroger.isUserAuthenticated).toHaveBeenCalled();
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('kroger://auth/status');
        expect(result.contents[0].mimeType).toBe('application/json');

        const parsed = JSON.parse(result.contents[0].text as string);
        expect(parsed.authenticated).toBe(true);
        expect(parsed.message).toContain('authenticated with Kroger');
      });

      it('should return not authenticated status when user is not authenticated', async () => {
        mockKroger.isUserAuthenticated.mockResolvedValueOnce(false);

        const handler = readResourceHandler(mockKroger as unknown as KrogerService);
        const request: ReadResourceRequest = {
          method: 'resources/read',
          params: {
            uri: 'kroger://auth/status',
          },
        };

        const result = await handler(request);

        const parsed = JSON.parse(result.contents[0].text as string);
        expect(parsed.authenticated).toBe(false);
        expect(parsed.message).toContain('Not authenticated');
        expect(parsed.message).toContain('pantry-agent auth');
      });
    });

    describe('unknown resource', () => {
      it('should throw error for unknown resource URI', async () => {
        const handler = readResourceHandler(mockKroger as unknown as KrogerService);
        const request: ReadResourceRequest = {
          method: 'resources/read',
          params: {
            uri: 'kroger://unknown/resource',
          },
        };

        await expect(handler(request)).rejects.toThrow('Unknown resource: kroger://unknown/resource');
      });
    });
  });
});
