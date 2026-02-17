/**
 * Shared test helpers for MCP tests using the official SDK client/transport.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { vi } from 'vitest';
import { createMcpServer } from './server.js';
import type { KrogerService } from '../services/kroger.service.js';

/** Type for callTool results (SDK returns unknown content) */
export type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

export function createMockKrogerService() {
  return {
    searchProducts: vi.fn(),
    searchProductsPage: vi.fn(),
    getProduct: vi.fn(),
    findStores: vi.fn(),
    findStoresPage: vi.fn(),
    getStore: vi.fn(),
    addToCart: vi.fn(),
    getProfile: vi.fn(),
    isUserAuthenticated: vi.fn(),
    getAuthService: vi.fn(),
    getUserScope: vi.fn(),
  };
}

/**
 * Create a connected MCP client/server pair using InMemoryTransport.
 * Returns the client (for making requests) and the mock service (for setting up mocks).
 */
export async function createTestClient(mockKroger?: ReturnType<typeof createMockKrogerService>) {
  const mock = mockKroger ?? createMockKrogerService();
  const server = createMcpServer(mock as unknown as KrogerService);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: 'test-client', version: '1.0.0' });

  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  /** Typed wrapper for client.callTool */
  const callTool = (params: Parameters<typeof client.callTool>[0]) =>
    client.callTool(params) as Promise<ToolResult>;

  return { client, server, mockKroger: mock, callTool };
}
