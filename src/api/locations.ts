/**
 * Kroger Locations API
 */

import type { KrogerClient } from './client.js';
import type { Location, LocationsResponse } from './types.js';

export interface FindLocationsParams {
  zipCode?: string;
  lat?: number;
  lon?: number;
  radiusInMiles?: number;
  limit?: number;
  chain?: string;
}

export class LocationsAPI {
  constructor(private readonly client: KrogerClient) {}

  /**
   * Find locations near a location
   * No special scope required
   */
  async find(params: FindLocationsParams, accessToken: string): Promise<LocationsResponse> {
    const queryParams = new URLSearchParams({
      'filter.limit': String(params.limit ?? 5),
    });

    if (params.zipCode) {
      queryParams.set('filter.zipCode.near', params.zipCode);
    } else if (params.lat !== undefined && params.lon !== undefined) {
      queryParams.set('filter.lat.near', String(params.lat));
      queryParams.set('filter.lon.near', String(params.lon));
    }

    if (params.radiusInMiles) {
      queryParams.set('filter.radiusInMiles', String(params.radiusInMiles));
    }

    if (params.chain) {
      queryParams.set('filter.chain', params.chain);
    }

    return this.client.request<LocationsResponse>(
      `/locations?${queryParams.toString()}`,
      accessToken
    );
  }

  /**
   * Get location by ID
   * No special scope required
   */
  async getById(locationId: string, accessToken: string): Promise<Location> {
    const response = await this.client.request<{ data: Location }>(
      `/locations/${locationId}`,
      accessToken
    );

    return response.data;
  }
}
