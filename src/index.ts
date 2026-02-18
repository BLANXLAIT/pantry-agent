#!/usr/bin/env node
/**
 * Pantry Agent - Entry Point
 *
 * Routes to CLI commands (auth, help, data subcommands) when args are present,
 * otherwise starts the MCP server.
 */

const args = process.argv.slice(2);
const command = args[0];

const cliCommands = new Set(['auth', 'serve', 'help', '--help', '-h']);
const dataCommands = new Set(['stores', 'store', 'search', 'product', 'cart']);

if (cliCommands.has(command)) {
  // Dynamic import to avoid loading MCP deps for CLI commands
  import('./cli.js').catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
} else if (dataCommands.has(command)) {
  // Data subcommands — output JSON to stdout
  import('./commands.js').then(({ runCommand }) =>
    runCommand(command, args.slice(1))
  ).catch((error) => {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : 'Fatal error' }));
    process.exit(1);
  });
} else {
  // No args or unrecognized command: start MCP server
  import('./services/kroger.service.js').then(({ KrogerService }) =>
    import('./mcp/server.js').then(({ startMcpServer }) =>
      import('./config.js').then(async ({ loadConfig }) => {
        const config = loadConfig();
        const kroger = new KrogerService(config);
        await startMcpServer(kroger);
      })
    )
  ).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
