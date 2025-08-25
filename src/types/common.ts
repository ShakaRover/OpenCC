/**
 * Common types and interfaces for OpenCC
 */

import type { AnthropicModel } from './anthropic';
import type { OpenAIModel } from './openai';

// 配置模式枚举
export enum ConfigMode {
  QWEN_CLI = 'qwen-cli',
  UNIVERSAL_OPENAI = 'universal-openai'
}

// 命令行参数接口
export interface CLIArguments {
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  qwenOauthFile?: string;
  model?: string;
  modelMapping?: string;
  verboseMessages?: boolean;
}

// 新的简化模型映射规则
export interface ModelMappingRule {
  pattern: string;
  target: string;
  type: 'contains' | 'exact' | 'prefix' | 'suffix';
}

// 新的增强模型映射格式
export interface EnhancedModelMapping {
  mappings: ModelMappingRule[];
  defaultModel?: string;
}

// 保持向后兼容的原始模型映射格式
export interface LegacyModelMapping {
  [anthropicModel: string]: {
    openaiModel: OpenAIModel;
    contextLength?: number;  // 标记为可选，因为实际未使用
    maxTokens?: number;      // 标记为可选，因为实际未使用
    capabilities?: string[]; // 标记为可选，因为实际未使用
    targetModel?: string;    // 新字段，与openaiModel等价
  };
}

// 统一的模型映射类型（支持两种格式）
export type ModelMapping = EnhancedModelMapping | LegacyModelMapping;

export interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: 'development' | 'production' | 'test';
  corsOrigin: string | string[];
  corsCredentials: boolean;
}

export interface OpenAIConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries?: number;
  configMode: ConfigMode;
  oauthFilePath?: string;
  defaultModel?: string;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  format: 'json' | 'simple';
  verboseLogging: boolean;
  verboseMessages: boolean;
}

export interface FeatureFlags {
  enableAudioSupport: boolean;
  enableFileSupport: boolean;
  enablePromptCaching: boolean;
  enableMetrics: boolean;
}

export interface AppConfig {
  server: ServerConfig;
  openai: OpenAIConfig;
  rateLimit: RateLimitConfig;
  logging: LoggingConfig;
  features: FeatureFlags;
  apiVersion: string;
  requestTimeout: number;
  maxRequestSize: string;
  healthCheckEnabled: boolean;
  debugMode: boolean;
}

export interface ConversionContext {
  requestId: string;
  timestamp: number;
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
  apiVersion?: string | undefined;
  metadata?: Record<string, any> | undefined;
}

export interface ConversionResult<T> {
  success: boolean;
  data?: T | undefined;
  error?: {
    type: string;
    message: string;
    details?: any;
  } | undefined;
  context: ConversionContext;
}

export interface RequestMetrics {
  requestId: string;
  startTime: number;
  endTime?: number | undefined;
  duration?: number | undefined;
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  model?: string | undefined;
  status: 'pending' | 'success' | 'error';
  errorType?: string | undefined;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: number;
  version: string;
  uptime: number;
  services: {
    openai: {
      status: 'up' | 'down';
      responseTime?: number;
    };
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

// Error types
export type ErrorType =
  | 'invalid_request_error'
  | 'authentication_error'
  | 'rate_limit_error'
  | 'api_error'
  | 'not_supported_error'
  | 'timeout_error'
  | 'network_error'
  | 'internal_error';

export interface StandardError {
  type: ErrorType;
  message: string;
  code?: string;
  param?: string;
  details?: any;
}

// HTTP Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: StandardError;
  requestId: string;
  timestamp: number;
}

// Stream types
export interface StreamChunk {
  id: string;
  type: string;
  data: any;
  timestamp: number;
}

export interface StreamContext {
  requestId: string;
  model: string;
  startTime: number;
  isComplete: boolean;
  errorOccurred: boolean;
}