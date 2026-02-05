/**
 * Authentication Service
 * Manages OAuth2 tokens for both app-level and user-level auth
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { KrogerClient } from '../api/client.js';
import type { StoredTokens, TokenResponse } from '../api/types.js';

const CONFIG_DIR = join(homedir(), '.pantry-agent');
const TOKENS_FILE = join(CONFIG_DIR, 'tokens.json');

// Buffer time before token expiration (5 minutes)
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export class AuthService {
  private appToken: { accessToken: string; expiresAt: number } | null = null;

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
}
