/**
 * MCP Server Setup
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { KrogerService } from '../services/kroger.service.js';
import { getToolsHandler, callToolHandler } from './tools.js';
import { getResourcesHandler, readResourceHandler } from './resources.js';
import { getPromptsHandler, getPromptHandler } from './prompts.js';

export function createMcpServer(kroger: KrogerService): Server {
  const server = new Server(
    {
      name: 'pantry-agent',
      version: '0.2.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, getToolsHandler());
  server.setRequestHandler(CallToolRequestSchema, callToolHandler(kroger));

  // Register resource handlers
  server.setRequestHandler(ListResourcesRequestSchema, getResourcesHandler());
  server.setRequestHandler(ReadResourceRequestSchema, readResourceHandler(kroger));

  // Register prompt handlers
  server.setRequestHandler(ListPromptsRequestSchema, getPromptsHandler());
  server.setRequestHandler(GetPromptRequestSchema, getPromptHandler());

  return server;
}

export async function startMcpServer(kroger: KrogerService): Promise<void> {
  const server = createMcpServer(kroger);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Log to stderr (stdout is reserved for MCP protocol)
  console.error('Pantry Agent MCP Server running on stdio');
}
