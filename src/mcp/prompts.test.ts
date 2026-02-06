/**
 * Tests for MCP Prompts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMcpServer } from './server.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KrogerService } from '../services/kroger.service.js';

const createMockKrogerService = () => ({
  searchProducts: vi.fn(),
  getProduct: vi.fn(),
  findStores: vi.fn(),
  getStore: vi.fn(),
  addToCart: vi.fn(),
  getProfile: vi.fn(),
  isUserAuthenticated: vi.fn(),
  getAuthService: vi.fn(),
  getUserScope: vi.fn(),
});

describe('MCP Prompts', () => {
  let server: McpServer;

  beforeEach(() => {
    const mockKroger = createMockKrogerService();
    server = createMcpServer(mockKroger as unknown as KrogerService);
    vi.clearAllMocks();
  });

  describe('Prompt Registration', () => {
    it('should register grocery-assistant prompt', async () => {
      const listPromptsHandler = (server.server as any)._requestHandlers.get('prompts/list');
      const result = await listPromptsHandler({ method: 'prompts/list', params: {} });

      const groceryPrompt = result.prompts.find((p: any) => p.name === 'grocery-assistant');
      expect(groceryPrompt).toBeDefined();
      expect(groceryPrompt?.description).toContain('grocery shopping');
    });

    it('should have proper arguments for grocery-assistant prompt', async () => {
      const listPromptsHandler = (server.server as any)._requestHandlers.get('prompts/list');
      const result = await listPromptsHandler({ method: 'prompts/list', params: {} });

      const groceryPrompt = result.prompts.find((p: any) => p.name === 'grocery-assistant');
      expect(groceryPrompt?.arguments).toBeDefined();

      const storeNameArg = groceryPrompt?.arguments?.find((a: any) => a.name === 'storeName');
      expect(storeNameArg).toBeDefined();
      expect(storeNameArg?.required).toBe(false);

      const locationIdArg = groceryPrompt?.arguments?.find((a: any) => a.name === 'locationId');
      expect(locationIdArg).toBeDefined();
      expect(locationIdArg?.required).toBe(false);
    });
  });

  describe('Prompt Execution', () => {
    it('should return prompt without context when no arguments provided', async () => {
      const getPromptHandler = (server.server as any)._requestHandlers.get('prompts/get');
      const result = await getPromptHandler({
        method: 'prompts/get',
        params: {
          name: 'grocery-assistant',
          arguments: {},
        },
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content.type).toBe('text');

      const text = (result.messages[0].content as any).text;
      expect(text).toContain('grocery shopping assistant');
      expect(text).toContain('find_stores');
      expect(text).toContain('search_products');
      expect(text).toContain('add_to_cart');
      expect(text).not.toContain('shopping at');
    });

    it('should include store context when storeName and locationId provided', async () => {
      const getPromptHandler = (server.server as any)._requestHandlers.get('prompts/get');
      const result = await getPromptHandler({
        method: 'prompts/get',
        params: {
          name: 'grocery-assistant',
          arguments: {
            storeName: 'Kroger on Main St',
            locationId: '01400943',
          },
        },
      });

      const text = (result.messages[0].content as any).text;
      expect(text).toContain('shopping at Kroger on Main St');
      expect(text).toContain('location ID: 01400943');
    });

    it('should suggest finding store when only storeName provided', async () => {
      const getPromptHandler = (server.server as any)._requestHandlers.get('prompts/get');
      const result = await getPromptHandler({
        method: 'prompts/get',
        params: {
          name: 'grocery-assistant',
          arguments: {
            storeName: 'Kroger',
          },
        },
      });

      const text = (result.messages[0].content as any).text;
      expect(text).toContain('wants to shop at Kroger');
      expect(text).toContain('find_stores to get the location ID');
    });

    it('should handle empty arguments object', async () => {
      const getPromptHandler = (server.server as any)._requestHandlers.get('prompts/get');
      const result = await getPromptHandler({
        method: 'prompts/get',
        params: {
          name: 'grocery-assistant',
          arguments: {},
        },
      });

      const text = (result.messages[0].content as any).text;
      expect(text).toContain('grocery shopping assistant');
      expect(text).not.toContain('shopping at');
    });
  });

  describe('Unknown Prompt', () => {
    it('should throw error for unknown prompt name', async () => {
      const getPromptHandler = (server.server as any)._requestHandlers.get('prompts/get');
      
      await expect(
        getPromptHandler({
          method: 'prompts/get',
          params: {
            name: 'unknown-prompt',
          },
        })
      ).rejects.toThrow();
    });
  });
});
