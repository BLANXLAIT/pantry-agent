/**
 * Tests for Configuration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
    it('should load config from environment variables', async () => {
      process.env.KROGER_CLIENT_ID = 'test-client-id';
      process.env.KROGER_CLIENT_SECRET = 'test-client-secret';

      const { loadConfig } = await import('./config.js');
      const config = loadConfig();

      expect(config.clientId).toBe('test-client-id');
      expect(config.clientSecret).toBe('test-client-secret');
      expect(config.environment).toBe('certification'); // default
    });

    it('should use certification environment by default', async () => {
      process.env.KROGER_CLIENT_ID = 'test-client-id';
      process.env.KROGER_CLIENT_SECRET = 'test-client-secret';

      const { loadConfig } = await import('./config.js');
      const config = loadConfig();

      expect(config.environment).toBe('certification');
    });

    it('should use production environment when specified', async () => {
      process.env.KROGER_CLIENT_ID = 'test-client-id';
      process.env.KROGER_CLIENT_SECRET = 'test-client-secret';
      process.env.KROGER_ENVIRONMENT = 'production';

      const { loadConfig } = await import('./config.js');
      const config = loadConfig();

      expect(config.environment).toBe('production');
    });

    it('should throw error when KROGER_CLIENT_ID is missing', async () => {
      process.env.KROGER_CLIENT_SECRET = 'test-client-secret';
      delete process.env.KROGER_CLIENT_ID;

      const { loadConfig } = await import('./config.js');

      expect(() => loadConfig()).toThrow('KROGER_CLIENT_ID environment variable is required');
    });

    it('should throw error when KROGER_CLIENT_SECRET is missing', async () => {
      process.env.KROGER_CLIENT_ID = 'test-client-id';
      delete process.env.KROGER_CLIENT_SECRET;

      const { loadConfig } = await import('./config.js');

      expect(() => loadConfig()).toThrow('KROGER_CLIENT_SECRET environment variable is required');
    });

    it('should throw error when both env vars are missing', async () => {
      delete process.env.KROGER_CLIENT_ID;
      delete process.env.KROGER_CLIENT_SECRET;

      const { loadConfig } = await import('./config.js');

      expect(() => loadConfig()).toThrow('KROGER_CLIENT_ID environment variable is required');
    });
  });
});
