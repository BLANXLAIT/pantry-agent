/**
 * Configuration loader
 */

import { config as loadEnv } from 'dotenv';
import type { KrogerClientConfig } from './api/client.js';

// Load .env file
loadEnv();

export function loadConfig(): KrogerClientConfig {
  const firebaseFunctionsUrl = process.env.FIREBASE_FUNCTIONS_URL;
  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;
  const environment = process.env.KROGER_ENVIRONMENT as 'certification' | 'production' | undefined;

  // Prefer Firebase Functions proxy (no secrets needed locally)
  if (firebaseFunctionsUrl) {
    return {
      firebaseFunctionsUrl,
      environment: environment ?? 'certification',
    };
  }

  // Fall back to direct credentials (for local development with .env)
  if (!clientId) {
    throw new Error('Either FIREBASE_FUNCTIONS_URL or KROGER_CLIENT_ID environment variable is required');
  }

  if (!clientSecret) {
    throw new Error('KROGER_CLIENT_SECRET environment variable is required when using direct credentials');
  }

  return {
    clientId,
    clientSecret,
    environment: environment ?? 'certification',
  };
}
