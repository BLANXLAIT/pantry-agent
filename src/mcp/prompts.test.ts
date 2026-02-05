/**
 * Tests for MCP Prompts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPromptsHandler, getPromptHandler } from './prompts.js';
import type { GetPromptRequest } from '@modelcontextprotocol/sdk/types.js';

describe('MCP Prompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPromptsHandler', () => {
    it('should return list of prompts', async () => {
      const handler = getPromptsHandler();
      const result = await handler({} as any);

      expect(result.prompts).toBeDefined();
      expect(result.prompts.length).toBeGreaterThan(0);

      // Verify grocery-assistant prompt exists
      const groceryPrompt = result.prompts.find((p) => p.name === 'grocery-assistant');
      expect(groceryPrompt).toBeDefined();
      expect(groceryPrompt?.description).toContain('grocery shopping');
    });

    it('should have proper arguments for grocery-assistant prompt', async () => {
      const handler = getPromptsHandler();
      const result = await handler({} as any);

      const groceryPrompt = result.prompts.find((p) => p.name === 'grocery-assistant');
      expect(groceryPrompt?.arguments).toBeDefined();

      const storeNameArg = groceryPrompt?.arguments?.find((a) => a.name === 'storeName');
      expect(storeNameArg).toBeDefined();
      expect(storeNameArg?.required).toBe(false);

      const locationIdArg = groceryPrompt?.arguments?.find((a) => a.name === 'locationId');
      expect(locationIdArg).toBeDefined();
      expect(locationIdArg?.required).toBe(false);
    });
  });

  describe('getPromptHandler', () => {
    describe('grocery-assistant', () => {
      it('should return prompt without context when no arguments provided', async () => {
        const handler = getPromptHandler();
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'grocery-assistant',
          },
        };

        const result = await handler(request);

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
        const handler = getPromptHandler();
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'grocery-assistant',
            arguments: {
              storeName: 'Kroger on Main St',
              locationId: '01400943',
            },
          },
        };

        const result = await handler(request);

        const text = (result.messages[0].content as any).text;
        expect(text).toContain('shopping at Kroger on Main St');
        expect(text).toContain('location ID: 01400943');
      });

      it('should suggest finding store when only storeName provided', async () => {
        const handler = getPromptHandler();
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'grocery-assistant',
            arguments: {
              storeName: 'Kroger',
            },
          },
        };

        const result = await handler(request);

        const text = (result.messages[0].content as any).text;
        expect(text).toContain('wants to shop at Kroger');
        expect(text).toContain('find_stores to get the location ID');
      });

      it('should handle empty arguments object', async () => {
        const handler = getPromptHandler();
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'grocery-assistant',
            arguments: {},
          },
        };

        const result = await handler(request);

        const text = (result.messages[0].content as any).text;
        expect(text).toContain('grocery shopping assistant');
        expect(text).not.toContain('shopping at');
      });
    });

    describe('unknown prompt', () => {
      it('should throw error for unknown prompt name', async () => {
        const handler = getPromptHandler();
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'unknown-prompt',
          },
        };

        await expect(handler(request)).rejects.toThrow('Unknown prompt: unknown-prompt');
      });
    });
  });
});
