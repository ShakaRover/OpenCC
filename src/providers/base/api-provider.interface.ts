/**
 * Core API Provider Interface
 * Defines the contract for all API providers in the system
 */

import type { OpenAIRequest, OpenAIResponse, OpenAIModelsResponse, ConversionContext } from '@/types';

/**
 * Protocol types supported by the system
 */
export enum ProtocolType {
  OPENAI = 'openai',
  GEMINI = 'gemini',
  ANTHROPIC = 'anthropic',
  CLAUDE = 'claude',
  CUSTOM = 'custom'
}

/**
 * HTTP methods supported by endpoints
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * API endpoint configuration
 */
export interface APIEndpoint {
  /** Endpoint type identifier */
  type: 'chat' | 'models' | 'health' | 'embeddings' | 'custom';
  /** HTTP method */
  method: HttpMethod;
  /** URL path template (may contain variables like {model}) */
  path: string;
  /** Whether this endpoint requires a model parameter */
  requiresModel?: boolean;
  /** Where to place model parameter */
  modelPlacement?: 'path' | 'query' | 'body';
  /** Path variables that need to be replaced */
  pathVariables?: string[];
}

/**
 * Protocol-specific endpoint configurations
 */
export interface ProtocolEndpoints {
  chat: APIEndpoint;
  models: APIEndpoint;
  health?: APIEndpoint;
  embeddings?: APIEndpoint;
  custom?: Record<string, APIEndpoint>;
}

/**
 * Provider health status information
 */
export interface ProviderHealthStatus {
  isHealthy: boolean;
  responseTime: number;
  error?: string;
  details?: Record<string, any>;
  lastChecked: number;
}

/**
 * Provider capabilities information
 */
export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsMultiModal: boolean;
  supportedModels: string[];
  maxTokens: number;
  maxContextLength: number;
  protocolVersion: string;
  customFeatures?: Record<string, boolean>;
}

/**
 * URL building options
 */
export interface URLBuildOptions {
  model?: string;
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
}

/**
 * Main API Provider interface
 * All provider implementations must implement this interface
 */
export interface APIProvider {
  /** Provider name (e.g., 'qwen', 'openai', 'gemini') */
  readonly name: string;
  
  /** Provider version */
  readonly version: string;
  
  /** Protocol type this provider implements */
  readonly protocol: ProtocolType;
  
  /** Base URL for the API */
  readonly baseUrl: string;
  
  /**
   * Send a non-streaming request to the provider
   */
  sendRequest(
    request: OpenAIRequest, 
    context: ConversionContext
  ): Promise<Response>;
  
  /**
   * Send a streaming request to the provider
   */
  sendStreamRequest(
    request: OpenAIRequest, 
    context: ConversionContext
  ): Promise<Response>;
  
  /**
   * Get available models from the provider
   */
  getModels(): Promise<OpenAIModelsResponse>;
  
  /**
   * Test connection to the provider
   */
  testConnection(): Promise<ProviderHealthStatus>;
  
  /**
   * Get provider capabilities
   */
  getCapabilities(): ProviderCapabilities;
  
  /**
   * Build request URL for a specific endpoint
   */
  buildRequestUrl(endpoint: APIEndpoint, options?: URLBuildOptions): string;
  
  /**
   * Get authentication headers for requests
   */
  getAuthHeaders(): Promise<Record<string, string>>;
  
  /**
   * Adapt request format for provider-specific requirements (optional)
   */
  adaptRequest?(request: OpenAIRequest): any;
  
  /**
   * Adapt response format from provider-specific format (optional)
   */
  adaptResponse?(response: any): OpenAIResponse;
  
  /**
   * Initialize or refresh provider authentication (optional)
   */
  initialize?(): Promise<void>;
  
  /**
   * Clean up provider resources (optional)
   */
  dispose?(): Promise<void>;
}

/**
 * Authentication provider interface
 */
export interface AuthProvider {
  /**
   * Get authentication headers for requests
   */
  getAuthHeaders(): Promise<Record<string, string>>;
  
  /**
   * Check if authentication is valid
   */
  isValid(): Promise<boolean>;
  
  /**
   * Refresh authentication credentials (optional)
   */
  refresh?(): Promise<void>;
  
  /**
   * Get authentication status information
   */
  getStatus(): Promise<{
    isAuthenticated: boolean;
    expiresAt?: number;
    error?: string;
  }>;
}

/**
 * Configuration provider interface
 */
export interface ConfigProvider {
  /**
   * Get base URL for the API
   */
  getBaseUrl(): string;
  
  /**
   * Get API key or credential
   */
  getApiKey(): string;
  
  /**
   * Get request timeout in milliseconds
   */
  getTimeout(): number;
  
  /**
   * Get maximum retry attempts
   */
  getMaxRetries(): number;
  
  /**
   * Get additional configuration options
   */
  getOptions(): Record<string, any>;
}

/**
 * Provider error types
 */
export interface ProviderError extends Error {
  code: string;
  statusCode?: number;
  details?: any;
  provider: string;
}

/**
 * Provider request context
 */
export interface ProviderContext extends ConversionContext {
  provider: string;
  protocol: ProtocolType;
  endpoint: APIEndpoint;
  attempt: number;
  maxRetries: number;
}