/**
 * Qwen API Provider
 * Implements APIProvider interface for Qwen/通义千问 API
 */

import { logger } from '@/utils/helpers';
import { BaseProvider, URLBuilder } from '@/providers/base';
import { ProtocolType } from '@/providers/base';
import { QwenAuthProvider } from './qwen-auth-provider';
import { QwenConfigProvider } from './qwen-config-provider';
import type {
  ProviderCapabilities,
  ProviderHealthStatus,
  APIEndpoint,
  URLBuildOptions
} from '@/providers/base';
import type {
  OpenAIRequest,
  OpenAIResponse,
  OpenAIModelsResponse,
  ConversionContext
} from '@/types';

/**
 * Qwen API Provider
 * Implements the APIProvider interface for Qwen/通义千问 API
 */
export class QwenProvider extends BaseProvider {
  readonly name = 'qwen';
  readonly version = '1.0.0';
  readonly protocol = ProtocolType.OPENAI; // Qwen uses OpenAI-compatible protocol
  
  private qwenAuthProvider: QwenAuthProvider;
  private qwenConfigProvider: QwenConfigProvider;
  private dynamicBaseUrl: string | null = null;
  
  constructor() {
    const authProvider = new QwenAuthProvider();
    const configProvider = new QwenConfigProvider();
    
    super(authProvider, configProvider);
    
    this.qwenAuthProvider = authProvider;
    this.qwenConfigProvider = configProvider;
    
    // Initialize endpoints after protocol is set
    this.initializeEndpoints();
  }
  
  /**
   * Get base URL for Qwen API (dynamic from OAuth manager)
   */
  get baseUrl(): string {
    return this.dynamicBaseUrl || this.qwenConfigProvider.getBaseUrl();
  }
  
  /**
   * Initialize the Qwen provider
   */
  override async initialize(): Promise<void> {
    this.logOperation('initialize', {
      requestId: 'qwen-init',
      timestamp: Date.now()
    });
    
    try {
      // Initialize auth provider
      await this.qwenAuthProvider.initialize();
      
      // Get dynamic base URL from auth provider
      this.dynamicBaseUrl = await this.qwenAuthProvider.getBaseUrl();
      
      logger.info('Qwen provider initialized successfully', {
        provider: this.name,
        baseUrl: this.dynamicBaseUrl,
        protocol: this.protocol
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initialize Qwen provider', {
        provider: this.name,
        error: errorMessage
      });
      
      throw this.createProviderError(
        'INIT_ERROR',
        `Qwen provider initialization failed: ${errorMessage}`,
        { error }
      );
    }
  }
  
  /**
   * Send non-streaming request to Qwen API
   */
  async sendRequest(
    request: OpenAIRequest,
    context: ConversionContext
  ): Promise<Response> {
    this.validateRequest(request);
    
    const endpoint = this.getEndpoint('chat');
    const providerContext = this.createContext(request, context, endpoint);
    
    this.logOperation('sendRequest', context, {
      model: request.model,
      stream: request.stream,
      endpoint: endpoint.type
    });
    
    try {
      // Ensure we have fresh base URL
      if (!this.dynamicBaseUrl) {
        this.dynamicBaseUrl = await this.qwenAuthProvider.getBaseUrl();
      }
      
      const url = this.buildRequestUrl(endpoint);
      const headers = await this.getCommonHeaders(context);
      
      logger.debug('Sending request to Qwen API', {
        requestId: context.requestId,
        url,
        model: request.model,
        messageCount: request.messages.length
      });
      
      const response = await fetch(url, {
        method: endpoint.method,
        headers,
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Qwen API request failed', {
          requestId: context.requestId,
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        
        throw this.createProviderError(
          'API_ERROR',
          `Qwen API error: ${response.status} ${response.statusText}`,
          { status: response.status, error: errorText },
          response.status
        );
      }
      
      logger.debug('Qwen API request successful', {
        requestId: context.requestId,
        status: response.status
      });
      
      return response;
      
    } catch (error) {
      this.handleRequestError(error, providerContext);
    }
  }
  
  /**
   * Send streaming request to Qwen API
   */
  async sendStreamRequest(
    request: OpenAIRequest,
    context: ConversionContext
  ): Promise<Response> {
    this.validateRequest(request);
    
    const endpoint = this.getEndpoint('chat');
    const providerContext = this.createContext(request, context, endpoint);
    
    this.logOperation('sendStreamRequest', context, {
      model: request.model,
      stream: true,
      endpoint: endpoint.type
    });
    
    try {
      // Ensure we have fresh base URL
      if (!this.dynamicBaseUrl) {
        this.dynamicBaseUrl = await this.qwenAuthProvider.getBaseUrl();
      }
      
      const url = this.buildRequestUrl(endpoint);
      const headers = await this.getCommonHeaders(context);
      
      // Ensure streaming is enabled in request
      const streamRequest = { ...request, stream: true };
      
      logger.debug('Sending streaming request to Qwen API', {
        requestId: context.requestId,
        url,
        model: request.model,
        messageCount: request.messages.length
      });
      
      const response = await fetch(url, {
        method: endpoint.method,
        headers,
        body: JSON.stringify(streamRequest)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Qwen streaming API request failed', {
          requestId: context.requestId,
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        
        throw this.createProviderError(
          'STREAM_API_ERROR',
          `Qwen streaming API error: ${response.status} ${response.statusText}`,
          { status: response.status, error: errorText },
          response.status
        );
      }
      
      logger.debug('Qwen streaming API request successful', {
        requestId: context.requestId,
        status: response.status
      });
      
      return response;
      
    } catch (error) {
      this.handleRequestError(error, providerContext);
    }
  }
  
  /**
   * Get available models from Qwen API
   * Note: Qwen doesn't provide a models endpoint, so we return a predefined list
   */
  async getModels(): Promise<OpenAIModelsResponse> {
    try {
      logger.debug('Returning predefined Qwen models (no API endpoint available)');
      
      // Return only qwen3-coder-plus model as requested
      const predefinedModels = [
        'qwen3-coder-plus'
      ];
      
      const models: OpenAIModelsResponse = {
        object: 'list',
        data: predefinedModels.map((modelId, index) => ({
          id: modelId,
          object: 'model',
          created: Date.now() - (index * 1000), // Fake timestamps
          owned_by: 'qwen',
          permission: [],
          root: modelId,
          parent: null
        }))
      };
      
      logger.debug('Successfully returned predefined Qwen models', {
        modelCount: models.data.length,
        models: predefinedModels
      });
      
      return models;
      
    } catch (error) {
      throw this.createProviderError(
        'MODELS_FETCH_ERROR',
        `Failed to get Qwen models: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { 
          error,
          note: 'Qwen does not provide a models API endpoint'
        }
      );
    }
  }
  
  /**
   * Test connection to Qwen API
   * Note: Qwen doesn't support model listing, so we only check OAuth status and base URL
   */
  override async testConnection(): Promise<ProviderHealthStatus> {
    const startTime = Date.now();
    
    try {
      // Check OAuth credentials first
      const authStatus = await this.qwenAuthProvider.getStatus();
      
      if (!authStatus.isAuthenticated) {
        return {
          isHealthy: false,
          responseTime: Date.now() - startTime,
          error: 'Qwen OAuth credentials are not valid',
          lastChecked: Date.now(),
          details: { 
            authStatus,
            reason: 'OAuth authentication failed'
          }
        };
      }
      
      // Ensure we have a valid base URL
      if (!this.dynamicBaseUrl) {
        try {
          this.dynamicBaseUrl = await this.qwenAuthProvider.getBaseUrl();
        } catch (error) {
          return {
            isHealthy: false,
            responseTime: Date.now() - startTime,
            error: 'Failed to get Qwen base URL',
            lastChecked: Date.now(),
            details: { 
              authStatus,
              reason: 'Base URL retrieval failed',
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          };
        }
      }
      
      // Test basic connectivity by making a simple HEAD request to base URL
      try {
        const headers = await this.getAuthHeaders();
        const response = await fetch(this.dynamicBaseUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'OpenCC/1.0.0',
            ...headers
          },
          // Short timeout for health check
          signal: AbortSignal.timeout(5000)
        });
        
        // Even if the specific endpoint returns 404, as long as we get a response,
        // it means the server is reachable and our auth is working
        const isReachable = response.status < 500; // Accept 4xx but not 5xx errors
        
        if (!isReachable) {
          return {
            isHealthy: false,
            responseTime: Date.now() - startTime,
            error: `Qwen API server error: ${response.status} ${response.statusText}`,
            lastChecked: Date.now(),
            details: {
              authStatus,
              baseUrl: this.dynamicBaseUrl,
              httpStatus: response.status,
              reason: 'Server error response'
            }
          };
        }
        
      } catch (fetchError) {
        // Network or timeout error
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Network error';
        
        return {
          isHealthy: false,
          responseTime: Date.now() - startTime,
          error: `Qwen API connectivity test failed: ${errorMessage}`,
          lastChecked: Date.now(),
          details: {
            authStatus,
            baseUrl: this.dynamicBaseUrl,
            reason: 'Network connectivity failed',
            error: errorMessage
          }
        };
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: true,
        responseTime,
        lastChecked: Date.now(),
        details: {
          authStatus,
          baseUrl: this.dynamicBaseUrl,
          reason: 'OAuth valid and server reachable'
        }
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        isHealthy: false,
        responseTime,
        error: `Qwen health check failed: ${errorMessage}`,
        lastChecked: Date.now(),
        details: { 
          error,
          reason: 'Unexpected error during health check'
        }
      };
    }
  }
  
  /**
   * Get Qwen provider capabilities
   */
  override getCapabilities(): ProviderCapabilities {
    return {
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
      supportsMultiModal: true,
      supportedModels: [
        'qwen3-coder-plus'
      ],
      maxTokens: 8192,
      maxContextLength: 32768,
      protocolVersion: '1.0.0',
      customFeatures: {
        supportsChineseDomainExpertise: true,
        supportsCodeGeneration: true,
        supportsMultiLanguage: true,
        requiresOAuth: true
      }
    };
  }
  
  /**
   * Build request URL with dynamic base URL
   */
  override buildRequestUrl(endpoint: APIEndpoint, options: URLBuildOptions = {}): string {
    // Use dynamic base URL if available
    const currentBaseUrl = this.dynamicBaseUrl || this.baseUrl;
    return URLBuilder.buildURL(currentBaseUrl, endpoint, options);
  }
  
  /**
   * Clean up Qwen provider resources
   */
  override async dispose(): Promise<void> {
    this.logOperation('dispose', {
      requestId: 'qwen-dispose',
      timestamp: Date.now()
    });
    
    // Reset dynamic base URL
    this.dynamicBaseUrl = null;
    
    logger.info('Qwen provider disposed', {
      provider: this.name
    });
  }
}