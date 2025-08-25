/**
 * OpenAI Configuration Provider
 * Manages OpenAI-specific configuration settings
 */

import { configManager } from '@/config';
import type { ConfigProvider } from '@/providers/base';

/**
 * OpenAI Configuration Provider
 * Implements ConfigProvider interface for OpenAI-specific settings
 */
export class OpenAIConfigProvider implements ConfigProvider {
  private readonly config: ReturnType<typeof configManager.getConfig>;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  
  constructor(apiKey?: string, baseUrl?: string) {
    this.config = configManager.getConfig();
    
    // Use provided values or fall back to config
    this.apiKey = apiKey || this.config.openai.apiKey;
    this.baseUrl = baseUrl || this.config.openai.baseUrl;
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    if (!this.baseUrl) {
      throw new Error('OpenAI base URL is required');
    }
  }
  
  /**
   * Get base URL for OpenAI API
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
  
  /**
   * Get OpenAI API key
   */
  getApiKey(): string {
    return this.apiKey;
  }
  
  /**
   * Get request timeout in milliseconds
   */
  getTimeout(): number {
    return this.config.openai.timeout || 30000; // Default 30 seconds for OpenAI
  }
  
  /**
   * Get maximum retry attempts
   */
  getMaxRetries(): number {
    return this.config.openai.maxRetries || 3;
  }
  
  /**
   * Get additional OpenAI-specific configuration options
   */
  getOptions(): Record<string, any> {
    return {
      configMode: this.config.openai.configMode,
      defaultModel: this.config.openai.defaultModel,
      enableDebugLogging: this.config.debugMode,
      verboseLogging: this.config.logging.verboseLogging,
      // OpenAI-specific options
      organization: process.env.OPENAI_ORG_ID,
      useStreamingByDefault: false,
      supportsBatch: true,
      supportsVision: true,
      supportsTools: true,
      supportsMultiModal: true,
      maxConcurrentRequests: 20,
      enableCaching: true,
      enableRetryOnRateLimit: true
    };
  }
  
  /**
   * Get default model for OpenAI
   */
  getDefaultModel(): string {
    return this.config.openai.defaultModel || 'gpt-3.5-turbo';
  }
  
  /**
   * Check if debug mode is enabled
   */
  isDebugMode(): boolean {
    return this.config.debugMode;
  }
  
  /**
   * Get OpenAI organization ID (if available)
   */
  getOrganizationId(): string | undefined {
    return process.env.OPENAI_ORG_ID;
  }
  
  /**
   * Get server configuration
   */
  getServerConfig(): {
    port: number;
    host: string;
    corsOrigin: string | string[];
  } {
    return {
      port: this.config.server.port,
      host: this.config.server.host,
      corsOrigin: this.config.server.corsOrigin
    };
  }
  
  /**
   * Get rate limiting configuration
   */
  getRateLimitConfig(): {
    windowMs: number;
    maxRequests: number;
  } {
    return {
      windowMs: this.config.rateLimit.windowMs,
      maxRequests: this.config.rateLimit.maxRequests
    };
  }
  
  /**
   * Get logging configuration
   */
  getLoggingConfig(): {
    level: string;
    format: string;
    verboseLogging: boolean;
  } {
    return {
      level: this.config.logging.level,
      format: this.config.logging.format,
      verboseLogging: this.config.logging.verboseLogging
    };
  }
  
  /**
   * Get feature flags
   */
  getFeatureFlags(): {
    enableAudioSupport: boolean;
    enableFileSupport: boolean;
    enablePromptCaching: boolean;
    enableMetrics: boolean;
  } {
    return {
      enableAudioSupport: this.config.features.enableAudioSupport,
      enableFileSupport: this.config.features.enableFileSupport,
      enablePromptCaching: this.config.features.enablePromptCaching,
      enableMetrics: this.config.features.enableMetrics
    };
  }
  
  /**
   * Validate configuration
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.apiKey) {
      errors.push('API key is required');
    } else if (typeof this.apiKey !== 'string') {
      errors.push('API key must be a string');
    }
    
    if (!this.baseUrl) {
      errors.push('Base URL is required');
    } else {
      try {
        new URL(this.baseUrl);
      } catch {
        errors.push('Base URL must be a valid URL');
      }
    }
    
    if (this.getTimeout() <= 0) {
      errors.push('Timeout must be positive');
    }
    
    if (this.getMaxRetries() < 0) {
      errors.push('Max retries cannot be negative');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}