/**
 * OpenAI API Provider
 * Implements APIProvider interface for standard OpenAI API
 */

import { logger } from '../../utils/helpers.js';
import { BaseProvider } from '../base/index.js';
import { ProtocolType } from '../base/index.js';
import { OpenAIAuthProvider } from './openai-auth-provider.js';
import { OpenAIConfigProvider } from './openai-config-provider.js';
import type {
  ProviderCapabilities,
  ProviderHealthStatus,
  APIEndpoint,
  URLBuildOptions
} from '../base/index.js';
import type {
  OpenAIRequest,
  OpenAIResponse,
  OpenAIModelsResponse,
  ConversionContext
} from '../../types/index.js';

/**
 * OpenAI API Provider
 * Implements the APIProvider interface for standard OpenAI API
 */
export class OpenAIProvider extends BaseProvider {
  readonly name = 'openai';
  readonly version = '1.0.0';
  readonly protocol = ProtocolType.OPENAI;
  readonly baseUrl: string;
  
  private openaiAuthProvider: OpenAIAuthProvider;
  private openaiConfigProvider: OpenAIConfigProvider;
  
  constructor(apiKey: string, baseUrl?: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    const configProvider = new OpenAIConfigProvider(apiKey, baseUrl);
    const authProvider = new OpenAIAuthProvider(apiKey);
    
    super(authProvider, configProvider);
    
    this.openaiAuthProvider = authProvider;
    this.openaiConfigProvider = configProvider;
    this.baseUrl = configProvider.getBaseUrl();
    
    // Initialize endpoints after protocol is set
    this.initializeEndpoints();
    
    // Validate configuration
    const validation = configProvider.validate();
    if (!validation.isValid) {
      throw new Error(`OpenAI provider configuration invalid: ${validation.errors.join(', ')}`);
    }
  }
  
  /**
   * Initialize the OpenAI provider
   */
  override async initialize(): Promise<void> {
    this.logOperation('initialize', {
      requestId: 'openai-init',
      timestamp: Date.now()
    });
    
    try {
      // Validate authentication
      const authStatus = await this.openaiAuthProvider.getStatus();
      
      if (!authStatus.isAuthenticated) {
        throw new Error(`Authentication invalid: ${authStatus.error}`);
      }
      
      logger.info('OpenAI provider initialized successfully', {
        provider: this.name,
        baseUrl: this.baseUrl,
        protocol: this.protocol,
        apiKeyMask: this.openaiAuthProvider.getMaskedApiKey()
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initialize OpenAI provider', {
        provider: this.name,
        error: errorMessage
      });
      
      throw this.createProviderError(
        'INIT_ERROR',
        `OpenAI provider initialization failed: ${errorMessage}`,
        { error }
      );
    }
  }
  
  /**
   * Send non-streaming request to OpenAI API
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
      const url = this.buildRequestUrl(endpoint);
      const headers = await this.getCommonHeaders(context);
      
      // Add organization header if available
      const orgId = this.openaiConfigProvider.getOrganizationId();
      if (orgId) {
        headers['OpenAI-Organization'] = orgId;
      }
      
      logger.debug('Sending request to OpenAI API', {
        requestId: context.requestId,
        url,
        model: request.model,
        messageCount: request.messages.length,
        hasTools: !!request.tools?.length
      });
      
      const response = await fetch(url, {
        method: endpoint.method,
        headers,
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText } };
        }
        
        logger.error('OpenAI API request failed', {
          requestId: context.requestId,
          url,
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        
        throw this.createProviderError(
          'API_ERROR',
          `OpenAI API error: ${response.status} ${response.statusText}`,
          { status: response.status, error: errorData },
          response.status
        );
      }
      
      logger.debug('OpenAI API request successful', {
        requestId: context.requestId,
        status: response.status
      });
      
      return response;
      
    } catch (error) {
      this.handleRequestError(error, providerContext);
    }
  }
  
  /**
   * Send streaming request to OpenAI API
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
      const url = this.buildRequestUrl(endpoint);
      const headers = await this.getCommonHeaders(context);
      
      // Add organization header if available
      const orgId = this.openaiConfigProvider.getOrganizationId();
      if (orgId) {
        headers['OpenAI-Organization'] = orgId;
      }
      
      // Ensure streaming is enabled in request
      const streamRequest = { ...request, stream: true };
      
      logger.debug('Sending streaming request to OpenAI API', {
        requestId: context.requestId,
        url,
        model: request.model,
        messageCount: request.messages.length,
        hasTools: !!request.tools?.length
      });
      
      const response = await fetch(url, {
        method: endpoint.method,
        headers,
        body: JSON.stringify(streamRequest)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText } };
        }
        
        logger.error('OpenAI streaming API request failed', {
          requestId: context.requestId,
          url,
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        
        throw this.createProviderError(
          'STREAM_API_ERROR',
          `OpenAI streaming API error: ${response.status} ${response.statusText}`,
          { status: response.status, error: errorData },
          response.status
        );
      }
      
      logger.debug('OpenAI streaming API request successful', {
        requestId: context.requestId,
        status: response.status
      });
      
      return response;
      
    } catch (error) {
      this.handleRequestError(error, providerContext);
    }
  }
  
  /**
   * Get available models from OpenAI API
   */
  async getModels(): Promise<OpenAIModelsResponse> {
    try {
      const endpoint = this.getEndpoint('models');
      const url = this.buildRequestUrl(endpoint);
      const headers = await this.getAuthHeaders();
      
      // Add organization header if available
      const orgId = this.openaiConfigProvider.getOrganizationId();
      if (orgId) {
        headers['OpenAI-Organization'] = orgId;
      }
      
      logger.debug('Fetching models from OpenAI API', { url });
      
      const response = await fetch(url, {
        method: endpoint.method,
        headers: {
          'User-Agent': 'OpenCC/1.0.0',
          ...headers
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw this.createProviderError(
          'MODELS_API_ERROR',
          `Failed to fetch models: ${response.status} ${response.statusText}`,
          { status: response.status, error: errorText },
          response.status
        );
      }
      
      const models = await response.json() as OpenAIModelsResponse;
      
      logger.debug('Successfully fetched OpenAI models', {
        modelCount: models.data?.length || 0
      });
      
      return models;
      
    } catch (error) {
      if (error instanceof Error && error.name === 'ProviderError') {
        throw error;
      }
      
      throw this.createProviderError(
        'MODELS_FETCH_ERROR',
        `Failed to get OpenAI models: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error }
      );
    }
  }
  
  /**
   * Test connection to OpenAI API
   */
  override async testConnection(): Promise<ProviderHealthStatus> {
    const startTime = Date.now();
    
    try {
      // Check authentication first
      const authStatus = await this.openaiAuthProvider.getStatus();
      
      if (!authStatus.isAuthenticated) {
        return {
          isHealthy: false,
          responseTime: Date.now() - startTime,
          error: 'OpenAI API key authentication failed',
          lastChecked: Date.now(),
          details: { authStatus }
        };
      }
      
      // Test API connection by fetching models
      await this.getModels();
      
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: true,
        responseTime,
        lastChecked: Date.now(),
        details: {
          authStatus,
          baseUrl: this.baseUrl,
          apiKeyMask: this.openaiAuthProvider.getMaskedApiKey()
        }
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
   * Get OpenAI provider capabilities
   */
  override getCapabilities(): ProviderCapabilities {
    return {
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
      supportsMultiModal: true,
      supportedModels: [
        'gpt-4',
        'gpt-4-turbo',
        'gpt-4-turbo-preview',
        'gpt-4-vision-preview',
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k',
        'text-davinci-003',
        'text-davinci-002'
      ],
      maxTokens: 4096,
      maxContextLength: 128000, // GPT-4 Turbo context length
      protocolVersion: '1.0.0',
      customFeatures: {
        supportsOrganizations: true,
        supportsFineTuning: true,
        supportsBatch: true,
        supportsEmbeddings: true,
        supportsModeration: true,
        supportsImages: true,
        supportsAudio: true
      }
    };
  }
  
  /**
   * Clean up OpenAI provider resources
   */
  override async dispose(): Promise<void> {
    this.logOperation('dispose', {
      requestId: 'openai-dispose',
      timestamp: Date.now()
    });
    
    logger.info('OpenAI provider disposed', {
      provider: this.name
    });
  }
}