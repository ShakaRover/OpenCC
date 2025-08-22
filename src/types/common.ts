/**
 * Common types and interfaces for OpenCC
 */

import type { AnthropicModel } from './anthropic.js';
import type { OpenAIModel } from './openai.js';

export interface ModelMapping {
  [anthropicModel: string]: {
    openaiModel: OpenAIModel;
    contextLength: number;
    maxTokens: number;
    capabilities: string[];
  };
}

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