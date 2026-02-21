/**
 * Authentication Service
 * Manages OAuth2 tokens for both app-level and user-level auth
 */

import { createServer, type Server } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { URL } from 'node:url';
import open from 'open';
import type { KrogerClient } from '../api/client.js';
import type { StoredTokens, TokenResponse } from '../api/types.js';

const CONFIG_DIR = join(homedir(), '.pantry-agent');
const TOKENS_FILE = join(CONFIG_DIR, 'tokens.json');

// Buffer time before token expiration (5 minutes)
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// OAuth callback server config
const REDIRECT_PORT = 3000;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const AUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class AuthService {
  private appToken: { accessToken: string; expiresAt: number } | null = null;
  private authServer: Server | null = null;
  private authInProgress = false;
  private currentAuthUrl: string | null = null;

  constructor(private readonly client: KrogerClient) {}

  /**
   * Ensure config directory exists
   */
  private ensureConfigDir(): void {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Get app-level access token (client credentials)
   * Auto-refreshes when expired
   */
  async getAppToken(scope: string): Promise<string> {
    const now = Date.now();

    // Return cached token if still valid
    if (this.appToken && this.appToken.expiresAt > now + TOKEN_REFRESH_BUFFER_MS) {
      return this.appToken.accessToken;
    }

    // Get new token
    const response = await this.client.getClientToken(scope);
    this.appToken = {
      accessToken: response.access_token,
      expiresAt: now + response.expires_in * 1000,
    };

    return this.appToken.accessToken;
  }

  /**
   * Get stored user tokens
   */
  getStoredTokens(): StoredTokens | null {
    if (!existsSync(TOKENS_FILE)) {
      return null;
    }

    try {
      const content = readFileSync(TOKENS_FILE, 'utf-8');
      return JSON.parse(content) as StoredTokens;
    } catch {
      return null;
    }
  }

  /**
   * Store user tokens
   */
  storeTokens(tokens: StoredTokens): void {
    this.ensureConfigDir();
    writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  }

  /**
   * Clear stored tokens
   */
  clearTokens(): void {
    if (existsSync(TOKENS_FILE)) {
      writeFileSync(TOKENS_FILE, '', { mode: 0o600 });
    }
  }

  /**
   * Get valid user access token
   * Auto-refreshes if expired
   */
  async getUserToken(): Promise<string | null> {
    const stored = this.getStoredTokens();
    if (!stored) {
      return null;
    }

    const now = Date.now();

    // Token still valid
    if (stored.expiresAt > now + TOKEN_REFRESH_BUFFER_MS) {
      return stored.accessToken;
    }

    // Need to refresh
    if (!stored.refreshToken) {
      return null;
    }

    try {
      const response = await this.client.refreshToken(stored.refreshToken);
      const newTokens: StoredTokens = {
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        expiresAt: now + response.expires_in * 1000,
        scope: stored.scope,
      };
      this.storeTokens(newTokens);
      return newTokens.accessToken;
    } catch (error) {
      // Refresh token expired or invalid
      this.clearTokens();
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isUserAuthenticated(): Promise<boolean> {
    const token = await this.getUserToken();
    return token !== null;
  }

  /**
   * Handle OAuth callback - exchange code for tokens
   */
  async handleCallback(code: string, redirectUri: string, scope: string): Promise<void> {
    const response = await this.client.exchangeCode(code, redirectUri);
    const now = Date.now();

    const tokens: StoredTokens = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt: now + response.expires_in * 1000,
      scope,
    };

    this.storeTokens(tokens);
  }

  /**
   * Get authorization URL for user login
   */
  getAuthorizationUrl(redirectUri: string, scope: string): string {
    return this.client.getAuthorizationUrl(redirectUri, scope);
  }

  /**
   * Check if auth flow is currently in progress
   */
  isAuthInProgress(): boolean {
    return this.authInProgress;
  }

  /**
   * Start the OAuth flow - opens browser and waits for callback.
   * Returns the authorization URL so agents can present it to users.
   * If auth is already in progress, returns the existing URL immediately.
   */
  async startAuthFlow(scope: string): Promise<{ authUrl: string }> {
    if (this.authInProgress) {
      // Re-generate the URL if somehow currentAuthUrl was cleared
      return { authUrl: this.currentAuthUrl ?? this.client.getAuthorizationUrl(REDIRECT_URI, scope) };
    }

    this.authInProgress = true;
    const authUrl = this.client.getAuthorizationUrl(REDIRECT_URI, scope);
    this.currentAuthUrl = authUrl;

    // Create callback server
    this.authServer = createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${REDIRECT_PORT}`);

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          this.sendHtmlResponse(res, 400, '❌', 'Authentication Failed', `Error: ${error}`);
          this.cleanupAuthServer();
          return;
        }

        if (!code) {
          this.sendHtmlResponse(
            res,
            400,
            '❌',
            'Authentication Failed',
            'No authorization code received.'
          );
          this.cleanupAuthServer();
          return;
        }

        try {
          await this.handleCallback(code, REDIRECT_URI, scope);
          this.sendHtmlResponse(
            res,
            200,
            '✅',
            'Authentication Successful',
            'You are now logged in to Kroger.<br>Return to Claude and try your request again.'
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          this.sendHtmlResponse(res, 500, '❌', 'Authentication Failed', message);
        }

        this.cleanupAuthServer();
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    this.authServer.listen(REDIRECT_PORT, () => {
      open(authUrl);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      this.cleanupAuthServer();
    }, AUTH_TIMEOUT_MS);

    return { authUrl };
  }

  /**
   * Clean up auth server
   */
  private cleanupAuthServer(): void {
    if (this.authServer) {
      this.authServer.close();
      this.authServer = null;
    }
    this.authInProgress = false;
    this.currentAuthUrl = null;
  }

  /**
   * Send HTML response for OAuth callback
   */
  private sendHtmlResponse(
    res: import('node:http').ServerResponse,
    statusCode: number,
    icon: string,
    title: string,
    message: string
  ): void {
    res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>${icon} ${title}</h1>
          <p>${message}</p>
        </body>
      </html>
    `);
  }
}
