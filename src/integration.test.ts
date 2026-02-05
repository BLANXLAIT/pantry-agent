/**
 * Integration Tests
 *
 * Basic smoke tests for the MCP server integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KrogerService } from './services/kroger.service.js';
import { createMcpServer } from './mcp/server.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Mock global fetch for all tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock fs for auth service
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/mock/home'),
}));

describe('Integration Tests', () => {
  let krogerService: KrogerService;
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();

    krogerService = new KrogerService({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      environment: 'certification',
    });

    server = createMcpServer(krogerService);
  });

  it('should create MCP server with all components', () => {
    expect(server).toBeDefined();
    expect(server.server).toBeDefined();
  });

  it('should register tools handler', () => {
    const listToolsHandler = (server.server as any)._requestHandlers.get('tools/list');
    expect(listToolsHandler).toBeDefined();
  });

  it('should register resources handler', () => {
    const listResourcesHandler = (server.server as any)._requestHandlers.get('resources/list');
    expect(listResourcesHandler).toBeDefined();
  });

  it('should register prompts handler', () => {
    const listPromptsHandler = (server.server as any)._requestHandlers.get('prompts/list');
    expect(listPromptsHandler).toBeDefined();
  });
});
