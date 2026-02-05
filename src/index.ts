#!/usr/bin/env node
/**
 * Pantry Agent - MCP Server Entry Point
 *
 * This is the main entry point when running as an MCP server.
 * For CLI commands, see cli.ts
 */

import { KrogerService } from './services/kroger.service.js';
import { startMcpServer } from './mcp/server.js';
import { loadConfig } from './config.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const kroger = new KrogerService(config);
  await startMcpServer(kroger);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
