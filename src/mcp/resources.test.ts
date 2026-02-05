/**
 * Tests for MCP Resources
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMcpServer } from './server.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KrogerService } from '../services/kroger.service.js';

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
  let server: McpServer;

  beforeEach(() => {
    mockKroger = createMockKrogerService();
    server = createMcpServer(mockKroger as unknown as KrogerService);
    vi.clearAllMocks();
  });

  describe('Resource Registration', () => {
    it('should register auth status resource', async () => {
      const listResourcesHandler = (server.server as any)._requestHandlers.get('resources/list');
      expect(listResourcesHandler).toBeDefined();

      const result = await listResourcesHandler({ method: 'resources/list', params: {} });

      // Verify auth status resource exists
      const authResource = result.resources.find((r: any) => r.uri === 'kroger://auth/status');
      expect(authResource).toBeDefined();
      expect(authResource?.name).toBe('Authentication Status');
      expect(authResource?.mimeType).toBe('application/json');
    });
  });

  describe('Resource Reading', () => {
    it('should return authenticated status when user is authenticated', async () => {
      mockKroger.isUserAuthenticated.mockResolvedValueOnce(true);

      const readResourceHandler = (server.server as any)._requestHandlers.get('resources/read');
      const result = await readResourceHandler({
        method: 'resources/read',
        params: {
          uri: 'kroger://auth/status',
        },
      });

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

      const readResourceHandler = (server.server as any)._requestHandlers.get('resources/read');
      const result = await readResourceHandler({
        method: 'resources/read',
        params: {
          uri: 'kroger://auth/status',
        },
      });

      const parsed = JSON.parse(result.contents[0].text as string);
      expect(parsed.authenticated).toBe(false);
      expect(parsed.message).toContain('Not authenticated');
      expect(parsed.message).toContain('pantry-agent auth');
    });
  });
});
