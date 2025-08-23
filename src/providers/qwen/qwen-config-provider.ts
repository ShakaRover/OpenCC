/**
 * Qwen Configuration Provider
 * Manages Qwen-specific configuration settings
 */

import { configManager } from '../../config/index.js';
import type { ConfigProvider } from '../base/index.js';

/**
 * Qwen Configuration Provider
 * Implements ConfigProvider interface for Qwen-specific settings
 */
export class QwenConfigProvider implements ConfigProvider {
  private readonly config: ReturnType<typeof configManager.getConfig>;
  
  constructor() {
    this.config = configManager.getConfig();
  }
  
  /**
   * Get base URL - Will be determined by OAuth manager
   * This is a placeholder as Qwen base URL is dynamic
   */
  getBaseUrl(): string {
    // For Qwen, the actual base URL is provided by the OAuth manager
    // This is just a fallback value
    return 'https://ai-qwen.com';
  }
  
  /**
   * Get API key - Not used for Qwen (uses OAuth instead)
   */
  getApiKey(): string {
    // Qwen uses OAuth, not API keys
    return '';
  }
  
  /**
   * Get request timeout in milliseconds
   */
  getTimeout(): number {
    return this.config.openai.timeout || 60000; // Default 60 seconds for Qwen
  }
  
  /**
   * Get maximum retry attempts
   */
  getMaxRetries(): number {
    return this.config.openai.maxRetries || 3;
  }
  
  /**
   * Get additional Qwen-specific configuration options
   */
  getOptions(): Record<string, any> {
    return {
      configMode: this.config.openai.configMode,
      oauthFilePath: this.config.openai.oauthFilePath,
      defaultModel: this.config.openai.defaultModel,
      enableDebugLogging: this.config.debugMode,
      verboseLogging: this.config.logging.verboseLogging,
      // Qwen-specific options
      resourceUrl: 'portal.qwen.ai', // Default resource URL
      useOAuth: true,
      supportsBatch: false,
      supportsVision: true,
      maxConcurrentRequests: 10
    };
  }
  
  /**
   * Get OAuth file path for Qwen credentials
   */
  getOAuthFilePath(): string | undefined {
    return this.config.openai.oauthFilePath;
  }
  
  /**
   * Get default model for Qwen
   */
  getDefaultModel(): string {
    return this.config.openai.defaultModel || 'qwen-max';
  }
  
  /**
   * Check if debug mode is enabled
   */
  isDebugMode(): boolean {
    return this.config.debugMode;
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
}