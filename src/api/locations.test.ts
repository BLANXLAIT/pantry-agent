/**
 * Tests for LocationsAPI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocationsAPI } from './locations.js';
import type { KrogerClient } from './client.js';
import type { LocationsResponse, Location } from './types.js';

const createMockClient = () => ({
  request: vi.fn(),
});

describe('LocationsAPI', () => {
  let api: LocationsAPI;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    api = new LocationsAPI(mockClient as unknown as KrogerClient);
  });

  describe('find', () => {
    const mockLocationsResponse: LocationsResponse = {
      data: [
        {
          locationId: '01400943',
          storeNumber: '00943',
          divisionNumber: '014',
          chain: 'KROGER',
          name: 'Kroger',
          address: {
            addressLine1: '123 Main St',
            city: 'Cincinnati',
            state: 'OH',
            zipCode: '45202',
          },
          geolocation: {
            latitude: 39.1031,
            longitude: -84.5120,
            latLng: '39.1031,-84.5120',
          },
          phone: '513-555-1234',
        },
        {
          locationId: '01400944',
          storeNumber: '00944',
          divisionNumber: '014',
          chain: 'KROGER',
          name: 'Kroger Marketplace',
          address: {
            addressLine1: '456 Oak Ave',
            city: 'Cincinnati',
            state: 'OH',
            zipCode: '45203',
          },
          geolocation: {
            latitude: 39.1100,
            longitude: -84.5200,
            latLng: '39.1100,-84.5200',
          },
        },
      ],
      meta: {
        pagination: { start: 0, limit: 5, total: 2 },
      },
    };

    it('should find locations by ZIP code', async () => {
      mockClient.request.mockResolvedValueOnce(mockLocationsResponse);

      const result = await api.find({ zipCode: '45202' }, 'access-token');

      expect(result).toEqual(mockLocationsResponse);
      expect(mockClient.request).toHaveBeenCalledWith(
        expect.stringContaining('/locations?'),
        'access-token'
      );

      const url = mockClient.request.mock.calls[0][0] as string;
      expect(url).toContain('filter.zipCode.near=45202');
      expect(url).toContain('filter.limit=5');
    });

    it('should find locations by coordinates', async () => {
      mockClient.request.mockResolvedValueOnce(mockLocationsResponse);

      await api.find({ lat: 39.1031, lon: -84.5120 }, 'access-token');

      const url = mockClient.request.mock.calls[0][0] as string;
      expect(url).toContain('filter.lat.near=39.1031');
      expect(url).toContain('filter.lon.near=-84.512');
      expect(url).not.toContain('filter.zipCode');
    });

    it('should prefer ZIP code over coordinates when both provided', async () => {
      mockClient.request.mockResolvedValueOnce(mockLocationsResponse);

      await api.find({ zipCode: '45202', lat: 39.1031, lon: -84.5120 }, 'access-token');

      const url = mockClient.request.mock.calls[0][0] as string;
      expect(url).toContain('filter.zipCode.near=45202');
      expect(url).not.toContain('filter.lat.near');
      expect(url).not.toContain('filter.lon.near');
    });

    it('should use custom limit when provided', async () => {
      mockClient.request.mockResolvedValueOnce(mockLocationsResponse);

      await api.find({ zipCode: '45202', limit: 10 }, 'access-token');

      const url = mockClient.request.mock.calls[0][0] as string;
      expect(url).toContain('filter.limit=10');
    });

    it('should include radius filter when provided', async () => {
      mockClient.request.mockResolvedValueOnce(mockLocationsResponse);

      await api.find({ zipCode: '45202', radiusInMiles: 15 }, 'access-token');

      const url = mockClient.request.mock.calls[0][0] as string;
      expect(url).toContain('filter.radiusInMiles=15');
    });

    it('should include chain filter when provided', async () => {
      mockClient.request.mockResolvedValueOnce(mockLocationsResponse);

      await api.find({ zipCode: '45202', chain: 'KROGER' }, 'access-token');

      const url = mockClient.request.mock.calls[0][0] as string;
      expect(url).toContain('filter.chain=KROGER');
    });

    it('should not include optional parameters when not provided', async () => {
      mockClient.request.mockResolvedValueOnce(mockLocationsResponse);

      await api.find({ zipCode: '45202' }, 'access-token');

      const url = mockClient.request.mock.calls[0][0] as string;
      expect(url).not.toContain('filter.radiusInMiles');
      expect(url).not.toContain('filter.chain');
    });

    it('should handle empty params with default limit', async () => {
      mockClient.request.mockResolvedValueOnce(mockLocationsResponse);

      await api.find({}, 'access-token');

      const url = mockClient.request.mock.calls[0][0] as string;
      expect(url).toContain('filter.limit=5');
    });

    it('should propagate client errors', async () => {
      mockClient.request.mockRejectedValueOnce(new Error('API request failed: Server error'));

      await expect(api.find({ zipCode: '45202' }, 'token')).rejects.toThrow(
        'API request failed: Server error'
      );
    });
  });

  describe('getById', () => {
    const mockLocation: Location = {
      locationId: '01400943',
      storeNumber: '00943',
      divisionNumber: '014',
      chain: 'KROGER',
      name: 'Kroger',
      address: {
        addressLine1: '123 Main St',
        city: 'Cincinnati',
        state: 'OH',
        zipCode: '45202',
        county: 'Hamilton',
      },
      geolocation: {
        latitude: 39.1031,
        longitude: -84.5120,
        latLng: '39.1031,-84.5120',
      },
      phone: '513-555-1234',
      hours: {
        timezone: 'America/New_York',
        gmtOffset: '-05:00',
        open24: false,
        monday: { open: '06:00', close: '23:00', open24: false },
        tuesday: { open: '06:00', close: '23:00', open24: false },
        wednesday: { open: '06:00', close: '23:00', open24: false },
        thursday: { open: '06:00', close: '23:00', open24: false },
        friday: { open: '06:00', close: '23:00', open24: false },
        saturday: { open: '06:00', close: '23:00', open24: false },
        sunday: { open: '06:00', close: '22:00', open24: false },
      },
      departments: [
        { departmentId: 'bakery', name: 'Bakery' },
        { departmentId: 'deli', name: 'Deli' },
        { departmentId: 'pharmacy', name: 'Pharmacy' },
      ],
    };

    it('should get location by ID', async () => {
      mockClient.request.mockResolvedValueOnce({ data: mockLocation });

      const result = await api.getById('01400943', 'access-token');

      expect(result).toEqual(mockLocation);
      expect(mockClient.request).toHaveBeenCalledWith('/locations/01400943', 'access-token');
    });

    it('should propagate client errors', async () => {
      mockClient.request.mockRejectedValueOnce(new Error('API request failed: Not Found'));

      await expect(api.getById('invalid-id', 'token')).rejects.toThrow(
        'API request failed: Not Found'
      );
    });
  });
});
