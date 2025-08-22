/**
 * Configuration Manager
 * Handles application configuration and environment variables
 */

import { config } from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import type { 
  AppConfig, 
  ModelMapping,
  ServerConfig,
  OpenAIConfig,
  RateLimitConfig,
  LoggingConfig,
  FeatureFlags
} from '../types/index.js';

// Load environment variables
config();

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;
  private modelMapping: ModelMapping;

  private constructor() {
    this.config = this.loadConfig();
    this.modelMapping = {};
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfig(): AppConfig {
    const server: ServerConfig = {
      port: parseInt(process.env.PORT || '26666', 10),
      host: process.env.HOST || 'localhost',
      nodeEnv: (process.env.NODE_ENV as any) || 'development',
      corsOrigin: this.parseCorsOrigin(process.env.CORS_ORIGIN || '*'),
      corsCredentials: process.env.CORS_CREDENTIALS === 'true'
    };

    const openai: OpenAIConfig = {
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000', 10),
      maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10)
    };

    const rateLimit: RateLimitConfig = {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
      skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
      skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED === 'true'
    };

    const logging: LoggingConfig = {
      level: (process.env.LOG_LEVEL as any) || 'info',
      format: (process.env.LOG_FORMAT as any) || 'json',
      verboseLogging: process.env.VERBOSE_LOGGING === 'true'
    };

    const features: FeatureFlags = {
      enableAudioSupport: process.env.ENABLE_AUDIO_SUPPORT === 'true',
      enableFileSupport: process.env.ENABLE_FILE_SUPPORT === 'true',
      enablePromptCaching: process.env.ENABLE_PROMPT_CACHING === 'true',
      enableMetrics: process.env.ENABLE_METRICS === 'true'
    };

    return {
      server,
      openai,
      rateLimit,
      logging,
      features,
      apiVersion: process.env.API_VERSION || 'v1',
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '60000', 10),
      maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
      healthCheckEnabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
      debugMode: process.env.DEBUG_MODE === 'true'
    };
  }

  /**
   * Parse CORS origin configuration
   */
  private parseCorsOrigin(corsOrigin: string): string | string[] {
    if (corsOrigin === '*') {
      return '*';
    }
    
    if (corsOrigin.includes(',')) {
      return corsOrigin.split(',').map(origin => origin.trim());
    }
    
    return corsOrigin;
  }

  /**
   * Load model mapping from configuration file
   */
  async loadModelMapping(): Promise<void> {
    try {
      const mappingFile = process.env.DEFAULT_MODEL_MAPPING_FILE || 
        path.join(process.cwd(), 'config', 'model-mapping.json');
      
      const mappingData = await fs.readFile(mappingFile, 'utf-8');
      this.modelMapping = JSON.parse(mappingData);
    } catch (error) {
      console.warn('Failed to load model mapping, using defaults:', error);
      this.modelMapping = this.getDefaultModelMapping();
    }
  }

  /**
   * Get default model mapping if file loading fails
   */
  private getDefaultModelMapping(): ModelMapping {
    return {
      'claude-3-opus-20240229': {
        openaiModel: 'gpt-4-turbo-preview',
        contextLength: 128000,
        maxTokens: 4096,
        capabilities: ['text', 'images', 'tools', 'reasoning']
      },
      'claude-opus-4-20250514': {
        openaiModel: 'gpt-4-turbo-preview',
        contextLength: 128000,
        maxTokens: 4096,
        capabilities: ['text', 'images', 'tools', 'reasoning', 'advanced']
      },
      'claude-3-sonnet-20240229': {
        openaiModel: 'gpt-4',
        contextLength: 8192,
        maxTokens: 4096,
        capabilities: ['text', 'images', 'tools', 'balanced']
      },
      'claude-3-haiku-20240307': {
        openaiModel: 'gpt-3.5-turbo',
        contextLength: 16384,
        maxTokens: 4096,
        capabilities: ['text', 'images', 'speed']
      },
      'claude-instant-1.2': {
        openaiModel: 'gpt-3.5-turbo',
        contextLength: 16384,
        maxTokens: 4096,
        capabilities: ['text', 'speed', 'lightweight']
      }
    };
  }

  /**
   * Get application configuration
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Get server configuration
   */
  getServerConfig(): ServerConfig {
    return this.config.server;
  }

  /**
   * Get OpenAI configuration
   */
  getOpenAIConfig(): OpenAIConfig {
    return this.config.openai;
  }

  /**
   * Get rate limiting configuration
   */
  getRateLimitConfig(): RateLimitConfig {
    return this.config.rateLimit;
  }

  /**
   * Get logging configuration
   */
  getLoggingConfig(): LoggingConfig {
    return this.config.logging;
  }

  /**
   * Get feature flags
   */
  getFeatureFlags(): FeatureFlags {
    return this.config.features;
  }

  /**
   * Get model mapping
   */
  getModelMapping(): ModelMapping {
    return this.modelMapping;
  }

  /**
   * Get mapping for specific model
   */
  getModelMappingFor(anthropicModel: string): ModelMapping[string] | undefined {
    return this.modelMapping[anthropicModel];
  }

  /**
   * Check if model is supported
   */
  isModelSupported(anthropicModel: string): boolean {
    return anthropicModel in this.modelMapping;
  }

  /**
   * Get list of supported models
   */
  getSupportedModels(): string[] {
    return Object.keys(this.modelMapping);
  }

  /**
   * Validate configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate OpenAI API key
    if (!this.config.openai.apiKey) {
      errors.push('OPENAI_API_KEY is required');
    }

    // Validate port
    if (this.config.server.port < 1 || this.config.server.port > 65535) {
      errors.push('PORT must be between 1 and 65535');
    }

    // Validate timeout values
    if (this.config.openai.timeout < 1000) {
      errors.push('OPENAI_TIMEOUT must be at least 1000ms');
    }

    if (this.config.requestTimeout < 1000) {
      errors.push('REQUEST_TIMEOUT must be at least 1000ms');
    }

    // Validate rate limiting
    if (this.config.rateLimit.windowMs < 1000) {
      errors.push('RATE_LIMIT_WINDOW_MS must be at least 1000ms');
    }

    if (this.config.rateLimit.maxRequests < 1) {
      errors.push('RATE_LIMIT_MAX_REQUESTS must be at least 1');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get environment info
   */
  getEnvironmentInfo(): { [key: string]: any } {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      nodeEnv: this.config.server.nodeEnv,
      debugMode: this.config.debugMode,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Update model mapping at runtime
   */
  updateModelMapping(newMapping: Partial<ModelMapping>): void {
    Object.assign(this.modelMapping, newMapping);
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): void {
    this.config = this.loadConfig();
    this.modelMapping = this.getDefaultModelMapping();
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();