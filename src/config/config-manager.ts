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
  EnhancedModelMapping,
  LegacyModelMapping,
  ModelMappingRule,
  CLIArguments,
  ServerConfig,
  OpenAIConfig,
  RateLimitConfig,
  LoggingConfig,
  FeatureFlags
} from '../types/index.js';
import { ConfigMode } from '../types/index.js';

// Load environment variables
config();

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;
  private modelMapping: EnhancedModelMapping;
  private configMode: ConfigMode;
  private cliArgs: CLIArguments;

  private constructor() {
    this.cliArgs = this.parseCliArguments();
    this.configMode = this.detectConfigMode();
    this.config = this.loadConfig();
    this.modelMapping = { mappings: [] };
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Parse command line arguments with enhanced validation
   */
  private parseCliArguments(): CLIArguments {
    const args = process.argv.slice(2);
    const cliArgs: CLIArguments = {};
    
    console.log('Parsing CLI arguments:', args); // 调试信息
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (!arg) continue; // 跳过空参数
      
      // 处理等号形式的参数 (e.g., --openai-api-key=value)
      if (arg.includes('=')) {
        const [key, ...valueParts] = arg.split('=');
        const value = valueParts.join('='); // 重新组合值部分
        
        if (key) {
          this.setCliArgument(cliArgs, key, this.cleanQuotes(value || ''));
        }
        continue;
      }
      
      // 处理空格分隔的参数 (e.g., --openai-api-key value)
      switch (arg) {
        case '--openai-api-key':
          if (i + 1 < args.length && args[i + 1]) {
            cliArgs.openaiApiKey = this.cleanQuotes(args[++i]!);
          }
          break;
        case '--openai-base-url':
          if (i + 1 < args.length && args[i + 1]) {
            const rawUrl = this.cleanQuotes(args[++i]!);
            cliArgs.openaiBaseUrl = this.normalizeBaseUrl(rawUrl);
          }
          break;
        case '--qwen-oauth-file':
          if (i + 1 < args.length && args[i + 1]) {
            cliArgs.qwenOauthFile = this.cleanQuotes(args[++i]!);
          }
          break;
        case '--model':
          if (i + 1 < args.length && args[i + 1]) {
            cliArgs.model = this.cleanQuotes(args[++i]!);
          }
          break;
        case '--model-mapping':
          if (i + 1 < args.length && args[i + 1]) {
            cliArgs.modelMapping = this.cleanQuotes(args[++i]!);
          }
          break;
        case '--verbose-messages':
          cliArgs.verboseMessages = true;
          break;
      }
    }
    
    // 验证解析结果
    const validationResult = this.validateCliArguments(cliArgs);
    console.log('CLI arguments parsed:', cliArgs);
    console.log('Validation result:', validationResult);
    
    return cliArgs;
  }

  /**
   * Set CLI argument by key, supporting both forms
   */
  private setCliArgument(cliArgs: CLIArguments, key: string, value: string): void {
    switch (key) {
      case '--openai-api-key':
        cliArgs.openaiApiKey = value;
        break;
      case '--openai-base-url':
        cliArgs.openaiBaseUrl = this.normalizeBaseUrl(value);
        break;
      case '--qwen-oauth-file':
        cliArgs.qwenOauthFile = value;
        break;
      case '--model':
        cliArgs.model = value;
        break;
      case '--model-mapping':
        cliArgs.modelMapping = value;
        break;
      case '--verbose-messages':
        cliArgs.verboseMessages = value === 'true' || value === '';
        break;
    }
  }

  /**
   * Clean quotes from parameter values
   */
  private cleanQuotes(value: string): string {
    if (!value) return value;
    
    let cleaned = value.trim();
    
    // 移除首尾的引号（单引号或双引号）
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1);
    }
    
    // 处理不完整的引号（只有开始引号，没有结束引号）
    if (cleaned.startsWith('"') || cleaned.startsWith("'")) {
      cleaned = cleaned.slice(1);
    }
    
    return cleaned;
  }

  /**
   * Validate CLI arguments
   */
  private validateCliArguments(cliArgs: CLIArguments): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // 验证API密钥格式
    if (cliArgs.openaiApiKey && !cliArgs.openaiApiKey.startsWith('sk-') && 
        !cliArgs.openaiApiKey.startsWith('ms-')) {
      errors.push('Invalid API key format');
    }
    
    // 验证URL格式
    if (cliArgs.openaiBaseUrl) {
      try {
        new URL(cliArgs.openaiBaseUrl);
      } catch (e) {
        errors.push('Invalid base URL format');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Detect configuration mode based on provided parameters with enhanced debugging
   */
  private detectConfigMode(): ConfigMode {
    const debugInfo = {
      hasEnvKey: !!process.env.OPENAI_API_KEY,
      hasEnvBaseUrl: !!process.env.OPENAI_BASE_URL,
      hasCliKey: !!this.cliArgs.openaiApiKey,
      hasCliBaseUrl: !!this.cliArgs.openaiBaseUrl,
      cliArgsCount: Object.keys(this.cliArgs).length,
      envApiKey: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'none',
      envBaseUrl: process.env.OPENAI_BASE_URL || 'none',
      cliApiKey: this.cliArgs.openaiApiKey ? this.cliArgs.openaiApiKey.substring(0, 10) + '...' : 'none',
      cliBaseUrl: this.cliArgs.openaiBaseUrl || 'none',
      processArgv: process.argv
    };
    
    const hasOpenAIKey = debugInfo.hasEnvKey || debugInfo.hasCliKey;
    const hasOpenAIBaseUrl = debugInfo.hasEnvBaseUrl || debugInfo.hasCliBaseUrl;
    
    const mode = (hasOpenAIKey || hasOpenAIBaseUrl) ? 
      ConfigMode.UNIVERSAL_OPENAI : 
      ConfigMode.QWEN_CLI;
      
    console.log('Configuration mode detection:', {
      mode,
      ...debugInfo
    });
    
    return mode;
  }

  /**
   * Normalize base URL at parameter input stage
   * Intelligently handles URLs that may contain /v1 suffix or trailing slashes
   */
  private normalizeBaseUrl(url: string): string {
    let normalizedUrl = url.trim();
    
    // 移除末尾的斜杠
    normalizedUrl = normalizedUrl.replace(/\/+$/, '');
    
    // 如果URL以/v1结尾，移除它（因为/v1应该在endpoint path中）
    if (normalizedUrl.endsWith('/v1')) {
      normalizedUrl = normalizedUrl.slice(0, -3); // 移除 '/v1'
    }
    
    // 确保有协议头
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    
    return normalizedUrl;
  }
  /**
   * Load configuration from environment variables and CLI arguments
   */
  private loadConfig(): AppConfig {
    const server: ServerConfig = {
      port: parseInt(process.env.PORT || '26666', 10),
      host: process.env.HOST || 'localhost',
      nodeEnv: (process.env.NODE_ENV as any) || 'development',
      corsOrigin: this.parseCorsOrigin(process.env.CORS_ORIGIN || '*'),
      corsCredentials: process.env.CORS_CREDENTIALS === 'true'
    };

    // 根据配置模式决定OpenAI配置
    let openaiConfig: OpenAIConfig;
    
    if (this.configMode === ConfigMode.UNIVERSAL_OPENAI) {
      // 通用OpenAI模式
      const apiKey = this.cliArgs.openaiApiKey || process.env.OPENAI_API_KEY || '';
      // CLI参数已经标准化，只需要处理环境变量
      const envBaseUrl = process.env.OPENAI_BASE_URL ? this.normalizeBaseUrl(process.env.OPENAI_BASE_URL) : 'https://api.openai.com';
      const normalizedBaseUrl = this.cliArgs.openaiBaseUrl || envBaseUrl;
      const baseUrl = normalizedBaseUrl.endsWith('/v1') ? normalizedBaseUrl : normalizedBaseUrl + '/v1';
      
      openaiConfig = {
        apiKey,
        baseUrl,
        timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000', 10),
        maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10),
        configMode: ConfigMode.UNIVERSAL_OPENAI,
        defaultModel: this.cliArgs.model
      };
    } else {
      // qwen-cli模式
      const envBaseUrl = process.env.OPENAI_BASE_URL ? this.normalizeBaseUrl(process.env.OPENAI_BASE_URL) : 'https://api.openai.com';
      const normalizedBaseUrl = envBaseUrl;
      const baseUrl = normalizedBaseUrl.endsWith('/v1') ? normalizedBaseUrl : normalizedBaseUrl + '/v1';
      
      openaiConfig = {
        apiKey: process.env.OPENAI_API_KEY || '',
        baseUrl: envBaseUrl,
        timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000', 10),
        maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10),
        configMode: ConfigMode.QWEN_CLI,
        oauthFilePath: this.cliArgs.qwenOauthFile,
        defaultModel: this.cliArgs.model || 'qwen3-coder-plus'
      };
    }

    const rateLimit: RateLimitConfig = {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
      skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
      skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED === 'true'
    };

    const logging: LoggingConfig = {
      level: (process.env.LOG_LEVEL as any) || 'info',
      format: (process.env.LOG_FORMAT as any) || 'json',
      verboseLogging: process.env.VERBOSE_LOGGING === 'true',
      verboseMessages: this.cliArgs.verboseMessages || process.env.VERBOSE_MESSAGES === 'true'
    };

    const features: FeatureFlags = {
      enableAudioSupport: process.env.ENABLE_AUDIO_SUPPORT === 'true',
      enableFileSupport: process.env.ENABLE_FILE_SUPPORT === 'true',
      enablePromptCaching: process.env.ENABLE_PROMPT_CACHING === 'true',
      enableMetrics: process.env.ENABLE_METRICS === 'true'
    };

    return {
      server,
      openai: openaiConfig,
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
   * Load model mapping from configuration file or CLI parameter
   */
  async loadModelMapping(): Promise<void> {
    try {
      let mappingData: string;
      
      if (this.cliArgs.modelMapping) {
        // 从命令行参数加载
        if (this.cliArgs.modelMapping.startsWith('{')) {
          // JSON数据
          mappingData = this.cliArgs.modelMapping;
        } else {
          // 文件路径
          mappingData = await fs.readFile(this.cliArgs.modelMapping, 'utf-8');
        }
      } else {
        // 从默认文件加载
        const mappingFile = process.env.DEFAULT_MODEL_MAPPING_FILE || 
          path.join(process.cwd(), 'config', 'model-mapping.json');
        mappingData = await fs.readFile(mappingFile, 'utf-8');
      }
      
      const rawMapping = JSON.parse(mappingData);
      this.modelMapping = this.convertToEnhancedMapping(rawMapping);
    } catch (error) {
      console.warn('Failed to load model mapping, using defaults:', error);
      this.modelMapping = this.getDefaultEnhancedMapping();
    }
  }

  /**
   * Convert legacy or new mapping format to enhanced format
   */
  private convertToEnhancedMapping(rawMapping: any): EnhancedModelMapping {
    // 如果已经是新格式（有mappings字段）
    if (rawMapping.mappings && Array.isArray(rawMapping.mappings)) {
      return {
        mappings: rawMapping.mappings,
        defaultModel: rawMapping.defaultModel
      };
    }
    
    // 转换旧格式为新格式
    const mappings: ModelMappingRule[] = [];
    
    for (const [key, value] of Object.entries(rawMapping)) {
      if (typeof value === 'object' && value !== null && key !== 'defaultModel') {
        const target = (value as any).openaiModel || (value as any).targetModel;
        if (target) {
          mappings.push({
            pattern: key,
            target: target,
            type: 'exact' // 旧格式默认为精确匹配
          });
        }
      }
    }
    
    return {
      mappings,
      defaultModel: rawMapping.defaultModel
    };
  }

  /**
   * Get default enhanced model mapping
   */
  private getDefaultEnhancedMapping(): EnhancedModelMapping {
    return {
      mappings: [
        {
          pattern: 'claude-3-opus-20240229',
          target: 'gpt-4-turbo-preview',
          type: 'exact'
        },
        {
          pattern: 'claude-opus-4-20250514',
          target: 'gpt-4-turbo-preview',
          type: 'exact'
        },
        {
          pattern: 'claude-3-sonnet-20240229',
          target: 'gpt-4',
          type: 'exact'
        },
        {
          pattern: 'claude-3-haiku-20240307',
          target: 'gpt-3.5-turbo',
          type: 'exact'
        },
        {
          pattern: 'claude-instant-1.2',
          target: 'gpt-3.5-turbo',
          type: 'exact'
        }
      ]
    };
  }

  /**
   * Get default legacy model mapping (for backward compatibility)
   */
  private getDefaultLegacyMapping(): LegacyModelMapping {
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
  getModelMapping(): EnhancedModelMapping {
    return this.modelMapping;
  }

  /**
   * Get effective model based on mapping rules
   */
  getEffectiveModel(requestedModel: string): string {
    // 1. 遍历映射规则，按顺序匹配
    for (const rule of this.modelMapping.mappings) {
      if (this.isModelMatch(requestedModel, rule.pattern, rule.type)) {
        return rule.target;
      }
    }
    
    // 2. 使用 model-mapping 中的 defaultModel（优先级高于 --model 参数）
    if (this.modelMapping.defaultModel) {
      return this.modelMapping.defaultModel;
    }
    
    // 3. 使用 --model 参数（等价于 defaultModel，但优先级较低）
    if (this.config.openai.defaultModel) {
      return this.config.openai.defaultModel;
    }
    
    // 4. 返回原始模型（qwen-cli 模式下会使用自带默认模型 qwen3-coder-plus）
    return requestedModel;
  }
  
  /**
   * Check if model matches pattern
   */
  private isModelMatch(model: string, pattern: string, type: string): boolean {
    switch (type) {
      case 'exact': 
        return model === pattern;
      case 'prefix': 
        return model.startsWith(pattern);
      case 'suffix': 
        return model.endsWith(pattern);
      case 'contains':
      default: 
        return model.includes(pattern);
    }
  }

  /**
   * Get CLI model parameter
   */
  getCliModel(): string | undefined {
    return this.cliArgs.model;
  }
  
  /**
   * Get effective default model
   */
  getEffectiveDefaultModel(): string | undefined {
    // model-mapping 中的 defaultModel 优先级高于 --model 参数
    return this.modelMapping.defaultModel || this.cliArgs.model;
  }
  
  /**
   * Get configuration mode
   */
  getConfigMode(): ConfigMode {
    return this.configMode;
  }
  
  /**
   * Get CLI arguments
   */
  getCliArguments(): CLIArguments {
    return { ...this.cliArgs };
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): void {
    this.config = this.loadConfig();
    this.modelMapping = this.getDefaultEnhancedMapping();
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();