/**
 * Configuration loader
 */

import { config as loadEnv } from 'dotenv';
import type { KrogerClientConfig } from './api/client.js';

// Load .env file
loadEnv();

export function loadConfig(): KrogerClientConfig {
  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;
  const environment = process.env.KROGER_ENVIRONMENT as 'certification' | 'production' | undefined;

  if (!clientId) {
    throw new Error('KROGER_CLIENT_ID environment variable is required');
  }

  if (!clientSecret) {
    throw new Error('KROGER_CLIENT_SECRET environment variable is required');
  }

  return {
    clientId,
    clientSecret,
    environment: environment ?? 'certification',
  };
}
