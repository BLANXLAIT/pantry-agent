/**
 * MCP Resources
 * Resource registration for the MCP server
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KrogerService } from '../services/kroger.service.js';

export function registerResources(server: McpServer, kroger: KrogerService): void {
  server.registerResource(
    'Authentication Status',
    'kroger://auth/status',
    {
      description: 'Current Kroger authentication status',
      mimeType: 'application/json',
    },
    async () => {
      const isAuthenticated = await kroger.isUserAuthenticated();

      return {
        contents: [
          {
            uri: 'kroger://auth/status',
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                authenticated: isAuthenticated,
                message: isAuthenticated
                  ? 'User is authenticated with Kroger'
                  : 'Not authenticated. Run `pantry-agent auth` to log in.',
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
