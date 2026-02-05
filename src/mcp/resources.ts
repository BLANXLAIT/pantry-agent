/**
 * MCP Resources
 * Resource definitions for the MCP server
 */

import type {
  ListResourcesRequest,
  ReadResourceRequest,
  Resource,
} from '@modelcontextprotocol/sdk/types.js';
import type { KrogerService } from '../services/kroger.service.js';

const RESOURCES: Resource[] = [
  {
    uri: 'kroger://auth/status',
    name: 'Authentication Status',
    description: 'Current Kroger authentication status',
    mimeType: 'application/json',
  },
];

export function getResourcesHandler() {
  return async (_request: ListResourcesRequest) => ({
    resources: RESOURCES,
  });
}

export function readResourceHandler(kroger: KrogerService) {
  return async (request: ReadResourceRequest) => {
    const { uri } = request.params;

    switch (uri) {
      case 'kroger://auth/status': {
        const isAuthenticated = await kroger.isUserAuthenticated();

        return {
          contents: [
            {
              uri,
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

      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  };
}
