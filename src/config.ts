/**
 * Configuration loader
 */

import { config as loadEnv } from 'dotenv';
import type { KrogerClientConfig } from './api/client.js';

// Load .env file (for local development only)
loadEnv();

// Default Firebase Functions URL for production use
const DEFAULT_FIREBASE_URL = 'https://xcf2umzgsq-uc.a.run.app';

export function loadConfig(): KrogerClientConfig {
  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;

  // Use direct credentials if provided (local development)
  if (clientId && clientSecret) {
    return {
      clientId,
      clientSecret,
      environment: 'production',
    };
  }

  // Default: use Firebase Functions proxy (no secrets needed)
  return {
    firebaseFunctionsUrl: process.env.FIREBASE_FUNCTIONS_URL ?? DEFAULT_FIREBASE_URL,
    environment: 'production',
  };
}
