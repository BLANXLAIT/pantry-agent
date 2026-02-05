/**
 * Kroger Identity API
 */

import type { KrogerClient } from './client.js';
import type { Profile } from './types.js';

export class IdentityAPI {
  constructor(private readonly client: KrogerClient) {}

  /**
   * Get user profile
   * Requires scope: profile.compact
   * Requires user authentication (authorization code grant)
   */
  async getProfile(accessToken: string): Promise<Profile> {
    const response = await this.client.request<{ data: Profile }>('/identity/profile', accessToken);

    return response.data;
  }
}
