/**
 * Base Provider Implementation
 * Abstract base class providing common functionality for all API providers
 */

import { logger } from '../../utils/helpers.js';
import { URLBuilder } from './url-builder.js';
import { getProtocolEndpoints } from './protocol-endpoints.js';
import type {
  APIProvider,
  AuthProvider,
  ConfigProvider,
  ProtocolType,
  APIEndpoint,
  URLBuildOptions,
  ProviderHealthStatus,
  ProviderCapabilities,
  ProviderContext,
  ProviderError,
  ProtocolEndpoints
} from './api-provider.interface.js';
import type {
  OpenAIRequest,
  OpenAIResponse,
  OpenAIModelsResponse,
  ConversionContext
} from '../../types/index.js';

/**
 * Abstract base provider class
 * Provides common functionality for all API providers
 */
export abstract class BaseProvider implements APIProvider {
  protected readonly urlBuilder: URLBuilder;
  protected readonly endpoints: ProtocolEndpoints;
  
  constructor(
    protected readonly authProvider?: AuthProvider,
    protected readonly configProvider?: ConfigProvider
  ) {
    this.urlBuilder = URLBuilder;
    // Initialize endpoints after protocol is available (will be set by subclasses)
    this.endpoints = {} as ProtocolEndpoints;
  }
  
  // Abstract properties that must be implemented by concrete providers
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly protocol: ProtocolType;
  abstract readonly baseUrl: string;
  
  /**
   * Initialize endpoints - should be called by subclasses after protocol is set
   */
  protected initializeEndpoints(): void {
    (this.endpoints as any) = getProtocolEndpoints(this.protocol);
  }
  
  /**
   * Build request URL for a specific endpoint
   */
  buildRequestUrl(endpoint: APIEndpoint, options: URLBuildOptions = {}): string {
    try {
      return URLBuilder.buildURL(this.baseUrl, endpoint, options);
    } catch (error) {
      throw this.createProviderError(
        'URL_BUILD_ERROR',
        `Failed to build URL for endpoint ${endpoint.type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { endpoint, options }
      );
    }
  }
  
  /**
   * Get endpoint configuration for a specific type
   */
  protected getEndpoint(type: keyof ProtocolEndpoints): APIEndpoint {
    const endpoint = this.endpoints[type];
    if (!endpoint) {
      throw this.createProviderError(
        'ENDPOINT_NOT_SUPPORTED',
        `Endpoint '${String(type)}' not supported by ${this.protocol} protocol`,
        { type, protocol: this.protocol }
      );
    }
    return endpoint as APIEndpoint;
  }
  
  /**
   * Get authentication headers
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    if (this.authProvider) {
      try {
        return await this.authProvider.getAuthHeaders();
      } catch (error) {
        throw this.createProviderError(
          'AUTH_ERROR',
          `Failed to get authentication headers: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { error }
        );
      }
    }
    
    if (this.configProvider) {
      const apiKey = this.configProvider.getApiKey();
      if (apiKey) {
        return {
          'Authorization': `Bearer ${apiKey}`
        };
      }
    }
    
    return {};
  }
  
  /**
   * Get common request headers
   */
  protected async getCommonHeaders(context: ConversionContext): Promise<Record<string, string>> {
    const authHeaders = await this.getAuthHeaders();
    
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'OpenCC/1.0.0',
      'X-Request-ID': context.requestId,
      ...authHeaders
    };
  }
  
  /**
   * Create provider-specific error
   */
  protected createProviderError(
    code: string,
    message: string,
    details?: any,
    statusCode?: number
  ): ProviderError {
    const error = new Error(message) as ProviderError;
    error.name = 'ProviderError';
    error.code = code;
    error.provider = this.name;
    error.statusCode = statusCode;
    error.details = details;
    
    return error;
  }
  
  /**
   * Log provider operation
   */
  protected logOperation(
    operation: string,
    context: ConversionContext,
    details?: Record<string, any>
  ): void {
    logger.debug(`Provider operation: ${operation}`, {
      provider: this.name,
      protocol: this.protocol,
      requestId: context.requestId,
      ...details
    });
  }
  
  /**
   * Handle request errors with provider context
   */
  protected handleRequestError(error: any, context: ProviderContext): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('Provider request failed', {
      provider: this.name,
      protocol: this.protocol,
      requestId: context.requestId,
      endpoint: context.endpoint.type,
      attempt: context.attempt,
      maxRetries: context.maxRetries,
      error: errorMessage
    });
    
    if (error instanceof Error && error.name === 'ProviderError') {
      throw error;
    }
    
    throw this.createProviderError(
      'REQUEST_ERROR',
      errorMessage,
      { originalError: error, context }
    );
  }
  
  /**
   * Create request context
   */
  protected createContext(
    request: OpenAIRequest,
    baseContext: ConversionContext,
    endpoint: APIEndpoint,
    attempt: number = 1
  ): ProviderContext {
    return {
      ...baseContext,
      provider: this.name,
      protocol: this.protocol,
      endpoint,
      attempt,
      maxRetries: this.configProvider?.getMaxRetries() || 3
    };
  }
  
  /**
   * Validate request before sending
   */
  protected validateRequest(request: OpenAIRequest): void {
    if (!request) {
      throw this.createProviderError(
        'INVALID_REQUEST',
        'Request cannot be null or undefined'
      );
    }
    
    if (!request.messages || !Array.isArray(request.messages)) {
      throw this.createProviderError(
        'INVALID_REQUEST',
        'Request must contain messages array'
      );
    }
    
    if (request.messages.length === 0) {
      throw this.createProviderError(
        'INVALID_REQUEST',
        'Messages array cannot be empty'
      );
    }
  }
  
  /**
   * Get default capabilities (can be overridden by concrete providers)
   */
  getCapabilities(): ProviderCapabilities {
    return {
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: false,
      supportsMultiModal: false,
      supportedModels: [],
      maxTokens: 4096,
      maxContextLength: 4096,
      protocolVersion: '1.0.0'
    };
  }
  
  /**
   * Default test connection implementation
   */
  async testConnection(): Promise<ProviderHealthStatus> {
    const startTime = Date.now();
    
    try {
      await this.getModels();
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: true,
        responseTime,
        lastChecked: Date.now()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        isHealthy: false,
        responseTime,
        error: errorMessage,
        lastChecked: Date.now(),
        details: { error }
      };
    }
  }
  
  /**
   * Default initialization (can be overridden)
   */
  async initialize(): Promise<void> {
    this.logOperation('initialize', {
      requestId: 'init',
      timestamp: Date.now()
    });
    
    // Validate auth provider if present
    if (this.authProvider) {
      const isValid = await this.authProvider.isValid();
      if (!isValid) {
        throw this.createProviderError(
          'AUTH_INVALID',
          'Authentication provider is not valid'
        );
      }
    }
  }
  
  /**
   * Default cleanup (can be overridden)
   */
  async dispose(): Promise<void> {
    this.logOperation('dispose', {
      requestId: 'dispose',
      timestamp: Date.now()
    });
    
    // Override in concrete providers if cleanup is needed
  }
  
  // Abstract methods that must be implemented by concrete providers
  abstract sendRequest(
    request: OpenAIRequest,
    context: ConversionContext
  ): Promise<Response>;
  
  abstract sendStreamRequest(
    request: OpenAIRequest,
    context: ConversionContext
  ): Promise<Response>;
  
  abstract getModels(): Promise<OpenAIModelsResponse>;
}