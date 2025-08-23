/**
 * OpenAI Authentication Provider
 * Implements AuthProvider interface for OpenAI API Key authentication
 */

import { logger } from '../../utils/helpers.js';
import type { AuthProvider } from '../base/index.js';

/**
 * OpenAI Authentication Provider
 * Handles API key-based authentication for OpenAI and compatible APIs
 */
export class OpenAIAuthProvider implements AuthProvider {
  private readonly apiKey: string;
  
  constructor(apiKey: string) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('OpenAI API key is required and must be a string');
    }
    
    // Validate API key format (basic validation)
    if (!this.isValidApiKeyFormat(apiKey)) {
      logger.warn('OpenAI API key format may be invalid', {
        keyPrefix: apiKey.substring(0, 10) + '...'
      });
    }
    
    this.apiKey = apiKey;
  }
  
  /**
   * Get authentication headers for OpenAI API requests
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      'Authorization': `Bearer ${this.apiKey}`
    };
  }
  
  /**
   * Check if API key authentication is valid
   * Note: This is a basic format check, actual validation requires API call
   */
  async isValid(): Promise<boolean> {
    return this.isValidApiKeyFormat(this.apiKey);
  }
  
  /**
   * Refresh is not applicable for API key authentication
   */
  async refresh(): Promise<void> {
    // API keys don't need refreshing, this is a no-op
    logger.debug('Refresh called on OpenAI auth provider (no-op for API keys)');
  }
  
  /**
   * Get authentication status
   */
  async getStatus(): Promise<{
    isAuthenticated: boolean;
    expiresAt?: number;
    error?: string;
  }> {
    const isValidFormat = this.isValidApiKeyFormat(this.apiKey);
    
    return {
      isAuthenticated: isValidFormat,
      // API keys don't expire (unless revoked by user)
      error: isValidFormat ? undefined : 'Invalid API key format'
    };
  }
  
  /**
   * Validate API key format
   * Supports both OpenAI (sk-) and Microsoft/Azure (ms-) key formats
   */
  private isValidApiKeyFormat(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }
    
    // OpenAI API keys typically start with 'sk-'
    // Microsoft/Azure keys may start with 'ms-'
    // Allow custom formats for other providers
    const validPrefixes = ['sk-', 'ms-'];
    const hasValidPrefix = validPrefixes.some(prefix => apiKey.startsWith(prefix));
    
    // If it has a known prefix, check minimum length
    if (hasValidPrefix) {
      return apiKey.length >= 20; // Minimum reasonable length
    }
    
    // For custom providers, just check it's not empty and has reasonable length
    return apiKey.length >= 8;
  }
  
  /**
   * Get the API key (for debugging/logging purposes)
   * Returns only a masked version for security
   */
  getMaskedApiKey(): string {
    if (this.apiKey.length <= 10) {
      return '*'.repeat(this.apiKey.length);
    }
    
    return this.apiKey.substring(0, 6) + '*'.repeat(this.apiKey.length - 10) + this.apiKey.substring(this.apiKey.length - 4);
  }
}