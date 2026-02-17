/**
 * MCP Server Setup
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { KrogerService } from '../services/kroger.service.js';
import { registerTools } from './tools.js';
import { registerResources } from './resources.js';
import { registerPrompts } from './prompts.js';

export function createMcpServer(kroger: KrogerService): McpServer {
  const server = new McpServer({
    name: 'pantry-agent',
    version: '0.3.0',
  });

  // Register tools
  registerTools(server, kroger);

  // Register resources
  registerResources(server, kroger);

  // Register prompts
  registerPrompts(server);

  return server;
}

export async function startMcpServer(kroger: KrogerService): Promise<void> {
  const server = createMcpServer(kroger);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Log to stderr (stdout is reserved for MCP protocol)
  console.error('Pantry Agent MCP Server running on stdio');
}
