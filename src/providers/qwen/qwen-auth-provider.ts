/**
 * Qwen OAuth Authentication Provider
 * Wraps the existing Qwen OAuth manager into the AuthProvider interface
 */

import { logger } from '../../utils/helpers.js';
import { qwenOAuthManager } from '../../services/qwen-oauth-manager.js';
import type { AuthProvider } from '../base/index.js';

/**
 * Qwen OAuth Authentication Provider
 * Implements AuthProvider interface using the existing Qwen OAuth manager
 */
export class QwenAuthProvider implements AuthProvider {
  private readonly oauthManager: typeof qwenOAuthManager;
  
  constructor() {
    this.oauthManager = qwenOAuthManager;
  }
  
  /**
   * Get authentication headers for Qwen API requests
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      const accessToken = await this.oauthManager.getValidAccessToken();
      
      if (!accessToken) {
        throw new Error('No valid access token available');
      }
      
      return {
        'Authorization': `Bearer ${accessToken}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown OAuth error';
      logger.error('Failed to get Qwen OAuth headers', { error: errorMessage });
      throw new Error(`Qwen OAuth authentication failed: ${errorMessage}`);
    }
  }
  
  /**
   * Check if Qwen OAuth authentication is valid
   */
  async isValid(): Promise<boolean> {
    try {
      const status = await this.oauthManager.getCredentialStatus();
      return status.hasCredentials && !status.isExpired;
    } catch (error) {
      logger.warn('Failed to check Qwen OAuth validity', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
  
  /**
   * Refresh Qwen OAuth credentials
   */
  async refresh(): Promise<void> {
    try {
      // Try to get a fresh token (the OAuth manager should handle refresh automatically)
      await this.oauthManager.getValidAccessToken();
      logger.info('Qwen OAuth credentials refreshed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to refresh Qwen OAuth credentials', { error: errorMessage });
      throw new Error(`Failed to refresh Qwen OAuth: ${errorMessage}`);
    }
  }
  
  /**
   * Get detailed authentication status
   */
  async getStatus(): Promise<{
    isAuthenticated: boolean;
    expiresAt?: number;
    error?: string;
  }> {
    try {
      const status = await this.oauthManager.getCredentialStatus();
      
      return {
        isAuthenticated: status.hasCredentials && !status.isExpired,
        expiresAt: status.expiryDate ? new Date(status.expiryDate).getTime() : undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        isAuthenticated: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * Get the base URL for Qwen API (from OAuth manager)
   */
  async getBaseUrl(): Promise<string> {
    try {
      return await this.oauthManager.getBaseUrl();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get Qwen base URL', { error: errorMessage });
      throw new Error(`Failed to get Qwen base URL: ${errorMessage}`);
    }
  }
  
  /**
   * Initialize OAuth manager (if needed)
   */
  async initialize(): Promise<void> {
    try {
      // The existing OAuth manager should be already initialized
      // Just verify credentials are available
      const isValid = await this.isValid();
      
      if (!isValid) {
        logger.warn('Qwen OAuth credentials are not valid on initialization');
      }
      
      logger.debug('Qwen OAuth provider initialized', {
        isValid,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initialize Qwen OAuth provider', { error: errorMessage });
      throw new Error(`Qwen OAuth initialization failed: ${errorMessage}`);
    }
  }
}