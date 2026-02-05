/**
 * Tests for Configuration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { KrogerClientConfigDirect, KrogerClientConfigProxy } from './api/client.js';

// Store original env
const originalEnv = process.env;

// Mock dotenv
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

describe('Configuration', () => {
  beforeEach(() => {
    // Reset modules before each test
    vi.resetModules();
    // Create a fresh copy of process.env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('loadConfig', () => {
    it('should prefer Firebase Functions URL when provided', async () => {
      process.env.FIREBASE_FUNCTIONS_URL = 'https://test-proxy.run.app';

      const { loadConfig } = await import('./config.js');
      const config = loadConfig() as KrogerClientConfigProxy;

      expect(config.firebaseFunctionsUrl).toBe('https://test-proxy.run.app');
      expect(config.environment).toBe('certification');
    });

    it('should load direct credentials when no proxy URL', async () => {
      process.env.KROGER_CLIENT_ID = 'test-client-id';
      process.env.KROGER_CLIENT_SECRET = 'test-client-secret';

      const { loadConfig } = await import('./config.js');
      const config = loadConfig() as KrogerClientConfigDirect;

      expect(config.clientId).toBe('test-client-id');
      expect(config.clientSecret).toBe('test-client-secret');
      expect(config.environment).toBe('certification');
    });

    it('should use certification environment by default', async () => {
      process.env.FIREBASE_FUNCTIONS_URL = 'https://test-proxy.run.app';

      const { loadConfig } = await import('./config.js');
      const config = loadConfig();

      expect(config.environment).toBe('certification');
    });

    it('should use production environment when specified', async () => {
      process.env.FIREBASE_FUNCTIONS_URL = 'https://test-proxy.run.app';
      process.env.KROGER_ENVIRONMENT = 'production';

      const { loadConfig } = await import('./config.js');
      const config = loadConfig();

      expect(config.environment).toBe('production');
    });

    it('should throw error when no proxy URL and KROGER_CLIENT_ID is missing', async () => {
      process.env.KROGER_CLIENT_SECRET = 'test-client-secret';
      delete process.env.KROGER_CLIENT_ID;
      delete process.env.FIREBASE_FUNCTIONS_URL;

      const { loadConfig } = await import('./config.js');

      expect(() => loadConfig()).toThrow('Either FIREBASE_FUNCTIONS_URL or KROGER_CLIENT_ID environment variable is required');
    });

    it('should throw error when using direct credentials without KROGER_CLIENT_SECRET', async () => {
      process.env.KROGER_CLIENT_ID = 'test-client-id';
      delete process.env.KROGER_CLIENT_SECRET;
      delete process.env.FIREBASE_FUNCTIONS_URL;

      const { loadConfig } = await import('./config.js');

      expect(() => loadConfig()).toThrow('KROGER_CLIENT_SECRET environment variable is required when using direct credentials');
    });

    it('should throw error when no credentials at all', async () => {
      delete process.env.KROGER_CLIENT_ID;
      delete process.env.KROGER_CLIENT_SECRET;
      delete process.env.FIREBASE_FUNCTIONS_URL;

      const { loadConfig } = await import('./config.js');

      expect(() => loadConfig()).toThrow('Either FIREBASE_FUNCTIONS_URL or KROGER_CLIENT_ID environment variable is required');
    });
  });
});
