/**
 * Pantry Agent OAuth Functions
 *
 * Handles Kroger OAuth flow:
 * 1. /auth/start - Redirects user to Kroger consent page
 * 2. /auth/callback - Receives code, exchanges for tokens
 * 3. /auth/refresh - Refreshes access token using refresh token
 */

import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

// Secrets stored in Firebase
const krogerClientId = defineSecret('KROGER_CLIENT_ID');
const krogerClientSecret = defineSecret('KROGER_CLIENT_SECRET');

// Configuration
// Use 'production' for Identity/Cart APIs (user accounts not available in certification)
// Use 'certification' for Products/Locations APIs during development
const KROGER_ENV = process.env.KROGER_ENV || 'certification';
const KROGER_AUTH_URL = KROGER_ENV === 'production'
  ? 'https://api.kroger.com/v1/connect/oauth2'
  : 'https://api-ce.kroger.com/v1/connect/oauth2';
const SCOPES = 'cart.basic:write profile.compact product.compact';

/**
 * Helper to get base64 encoded credentials
 */
function getBasicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

/**
 * Start OAuth flow - redirects to Kroger
 * GET /auth/start?redirect_uri=...
 */
export const authStart = onRequest(
  { secrets: [krogerClientId] },
  (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.status(204).send('');
      return;
    }

    const redirectUri = req.query.redirect_uri as string;
    const state = req.query.state as string;

    if (!redirectUri) {
      res.status(400).json({ error: 'redirect_uri is required' });
      return;
    }

    const params = new URLSearchParams({
      client_id: krogerClientId.value().trim(),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      ...(state && { state }),
    });

    const authUrl = `${KROGER_AUTH_URL}/authorize?${params.toString()}`;
    res.redirect(authUrl);
  }
);

/**
 * Exchange authorization code for tokens
 * POST /auth/token
 * Body: { code, redirect_uri }
 */
export const authToken = onRequest(
  {
    secrets: [krogerClientId, krogerClientSecret],
  },
  async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { code, redirect_uri } = req.body;

    if (!code || !redirect_uri) {
      res.status(400).json({ error: 'code and redirect_uri are required' });
      return;
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri,
      });

      const response = await fetch(`${KROGER_AUTH_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${getBasicAuth(krogerClientId.value().trim(), krogerClientSecret.value().trim())}`,
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const error = await response.json();
        res.status(response.status).json(error);
        return;
      }

      const tokens = await response.json();
      res.json(tokens);
    } catch (error) {
      console.error('Token exchange error:', error);
      res.status(500).json({ error: 'Failed to exchange code for tokens' });
    }
  }
);

/**
 * Refresh access token
 * POST /auth/refresh
 * Body: { refresh_token }
 */
export const authRefresh = onRequest(
  {
    secrets: [krogerClientId, krogerClientSecret],
  },
  async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({ error: 'refresh_token is required' });
      return;
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token,
      });

      const response = await fetch(`${KROGER_AUTH_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${getBasicAuth(krogerClientId.value().trim(), krogerClientSecret.value().trim())}`,
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const error = await response.json();
        res.status(response.status).json(error);
        return;
      }

      const tokens = await response.json();
      res.json(tokens);
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ error: 'Failed to refresh token' });
    }
  }
);

/**
 * Get client token (for app-level API calls)
 * POST /auth/client-token
 * Body: { scope } (optional)
 */
export const authClientToken = onRequest(
  {
    secrets: [krogerClientId, krogerClientSecret],
  },
  async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const scope = req.body?.scope || 'product.compact';

    try {
      const clientId = krogerClientId.value().trim();
      const clientSecret = krogerClientSecret.value().trim();

      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        scope,
      });

      const response = await fetch(`${KROGER_AUTH_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${getBasicAuth(clientId, clientSecret)}`,
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Kroger error:', JSON.stringify(error));
        res.status(response.status).json(error);
        return;
      }

      const tokens = await response.json();
      res.json(tokens);
    } catch (error) {
      console.error('Client token error:', error);
      res.status(500).json({ error: 'Failed to get client token' });
    }
  }
);
