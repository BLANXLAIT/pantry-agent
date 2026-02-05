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
    // Clear any existing config env vars
    delete process.env.FIREBASE_FUNCTIONS_URL;
    delete process.env.KROGER_CLIENT_ID;
    delete process.env.KROGER_CLIENT_SECRET;
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('loadConfig', () => {
    it('should use default Firebase Functions URL when no env vars set', async () => {
      const { loadConfig } = await import('./config.js');
      const config = loadConfig() as KrogerClientConfigProxy;

      expect(config.firebaseFunctionsUrl).toBe('https://xcf2umzgsq-uc.a.run.app');
      expect(config.environment).toBe('production');
    });

    it('should use custom Firebase Functions URL when provided', async () => {
      process.env.FIREBASE_FUNCTIONS_URL = 'https://custom-proxy.run.app';

      const { loadConfig } = await import('./config.js');
      const config = loadConfig() as KrogerClientConfigProxy;

      expect(config.firebaseFunctionsUrl).toBe('https://custom-proxy.run.app');
      expect(config.environment).toBe('production');
    });

    it('should use direct credentials when both client ID and secret are provided', async () => {
      process.env.KROGER_CLIENT_ID = 'test-client-id';
      process.env.KROGER_CLIENT_SECRET = 'test-client-secret';

      const { loadConfig } = await import('./config.js');
      const config = loadConfig() as KrogerClientConfigDirect;

      expect(config.clientId).toBe('test-client-id');
      expect(config.clientSecret).toBe('test-client-secret');
      expect(config.environment).toBe('production');
    });

    it('should prefer direct credentials over Firebase URL', async () => {
      process.env.FIREBASE_FUNCTIONS_URL = 'https://test-proxy.run.app';
      process.env.KROGER_CLIENT_ID = 'test-client-id';
      process.env.KROGER_CLIENT_SECRET = 'test-client-secret';

      const { loadConfig } = await import('./config.js');
      const config = loadConfig() as KrogerClientConfigDirect;

      expect(config.clientId).toBe('test-client-id');
      expect(config.clientSecret).toBe('test-client-secret');
      expect('firebaseFunctionsUrl' in config).toBe(false);
    });

    it('should fall back to Firebase URL when only client ID is provided', async () => {
      process.env.KROGER_CLIENT_ID = 'test-client-id';
      // No KROGER_CLIENT_SECRET

      const { loadConfig } = await import('./config.js');
      const config = loadConfig() as KrogerClientConfigProxy;

      expect(config.firebaseFunctionsUrl).toBe('https://xcf2umzgsq-uc.a.run.app');
    });

    it('should always use production environment', async () => {
      const { loadConfig } = await import('./config.js');
      const config = loadConfig();

      expect(config.environment).toBe('production');
    });
  });
});
