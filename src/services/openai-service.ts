/**
 * OpenAI API Service Client
 * Handles communication with OpenAI API
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import type {
  OpenAIRequest,
  OpenAIResponse,
  OpenAIStreamChunk,
  OpenAIError,
  OpenAIModelsResponse,
  OpenAIConfig,
  ConversionContext
} from '@/types/index.js';

export class OpenAIService {
  private client: AxiosInstance;
  private config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'OpenCC/1.0.0'
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          // Transform axios error to OpenAI error format
          const openaiError: OpenAIError = {
            error: {
              message: error.response.data?.error?.message || error.message,
              type: error.response.data?.error?.type || 'api_error',
              code: error.response.data?.error?.code,
              param: error.response.data?.error?.param
            }
          };
          throw openaiError;
        }
        throw error;
      }
    );
  }

  /**
   * Send chat completion request to OpenAI
   */
  async createChatCompletion(
    request: OpenAIRequest,
    context: ConversionContext
  ): Promise<OpenAIResponse> {
    try {
      const response: AxiosResponse<OpenAIResponse> = await this.client.post(
        '/chat/completions',
        request,
        {
          headers: {
            'X-Request-ID': context.requestId
          }
        }
      );

      return response.data;
    } catch (error) {
      this.handleRequestError(error, context);
      throw error;
    }
  }

  /**
   * Send streaming chat completion request to OpenAI
   */
  async createStreamingChatCompletion(
    request: OpenAIRequest,
    context: ConversionContext
  ): Promise<AsyncIterable<string>> {
    try {
      const response = await this.client.post(
        '/chat/completions',
        { ...request, stream: true },
        {
          headers: {
            'X-Request-ID': context.requestId
          },
          responseType: 'stream'
        }
      );

      return this.processStreamingResponse(response.data);
    } catch (error) {
      this.handleRequestError(error, context);
      throw error;
    }
  }

  /**
   * Get available models from OpenAI
   */
  async getModels(): Promise<OpenAIModelsResponse> {
    try {
      const response: AxiosResponse<OpenAIModelsResponse> = await this.client.get('/models');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<{ success: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      await this.getModels();
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process streaming response from OpenAI
   */
  private async *processStreamingResponse(stream: any): AsyncIterable<string> {
    let buffer = '';

    for await (const chunk of stream) {
      buffer += chunk.toString();
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          yield line + '\n';
        }
      }
    }
    
    // Process remaining buffer
    if (buffer.trim()) {
      yield buffer + '\n';
    }
  }

  /**
   * Handle request errors
   */
  private handleRequestError(error: any, context: ConversionContext): void {
    console.error(`OpenAI API Error for request ${context.requestId}:`, {
      error: error.message || error,
      timestamp: new Date().toISOString(),
      context
    });
  }

  /**
   * Update API configuration
   */
  updateConfig(newConfig: Partial<OpenAIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update client defaults
    if (newConfig.apiKey) {
      this.client.defaults.headers['Authorization'] = `Bearer ${newConfig.apiKey}`;
    }
    
    if (newConfig.baseUrl) {
      this.client.defaults.baseURL = newConfig.baseUrl;
    }
    
    if (newConfig.timeout) {
      this.client.defaults.timeout = newConfig.timeout;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): OpenAIConfig {
    return { ...this.config };
  }
}