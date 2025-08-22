/**
 * Conversion Service
 * Orchestrates the conversion between Anthropic and OpenAI APIs
 */

import type {
  AnthropicRequest,
  AnthropicResponse,
  AnthropicError,
  ConversionContext,
  ConversionResult,
  ModelMapping,
  RequestMetrics
} from '@/types/index.js';

import { AnthropicToOpenAIConverter, OpenAIToAnthropicConverter } from '@/converters/index.js';
import { OpenAIService } from './openai-service.js';
import { generateRequestId, getCurrentTimestamp } from '@/utils/helpers.js';

export class ConversionService {
  private anthropicToOpenAI: AnthropicToOpenAIConverter;
  private openAIToAnthropic: OpenAIToAnthropicConverter;
  private openAIService: OpenAIService;
  private metrics: Map<string, RequestMetrics> = new Map();

  constructor(openAIService: OpenAIService, modelMapping: ModelMapping) {
    this.anthropicToOpenAI = new AnthropicToOpenAIConverter(modelMapping);
    this.openAIToAnthropic = new OpenAIToAnthropicConverter();
    this.openAIService = openAIService;
  }

  /**
   * Convert and process Anthropic request
   */
  async processRequest(
    anthropicRequest: AnthropicRequest,
    userAgent?: string,
    ipAddress?: string
  ): Promise<ConversionResult<AnthropicResponse>> {
    const requestId = generateRequestId();
    const startTime = Date.now();
    
    const context: ConversionContext = {
      requestId,
      timestamp: getCurrentTimestamp(),
      userAgent,
      ipAddress,
      apiVersion: anthropicRequest.anthropic_version,
      metadata: anthropicRequest.metadata
    };

    // Track metrics
    this.startMetrics(requestId, anthropicRequest.model, startTime);

    try {
      // Convert Anthropic request to OpenAI format
      const conversionResult = await this.anthropicToOpenAI.convertRequest(
        anthropicRequest,
        context
      );

      if (!conversionResult.success || !conversionResult.data) {
        this.updateMetrics(requestId, 'error', conversionResult.error?.type);
        return {
          success: false,
          error: conversionResult.error,
          context
        };
      }

      // Send request to OpenAI
      const openAIResponse = await this.openAIService.createChatCompletion(
        conversionResult.data,
        context
      );

      // Convert OpenAI response back to Anthropic format
      const responseResult = await this.openAIToAnthropic.convertResponse(
        openAIResponse,
        context,
        anthropicRequest.model
      );

      if (!responseResult.success || !responseResult.data) {
        this.updateMetrics(requestId, 'error', responseResult.error?.type);
        return {
          success: false,
          error: responseResult.error,
          context
        };
      }

      // Update metrics with success
      this.updateMetrics(
        requestId,
        'success',
        undefined,
        responseResult.data.usage.input_tokens,
        responseResult.data.usage.output_tokens
      );

      return {
        success: true,
        data: responseResult.data,
        context
      };

    } catch (error) {
      this.updateMetrics(requestId, 'error', 'api_error');
      
      // Handle OpenAI API errors
      if (this.isOpenAIError(error)) {
        const errorResult = await this.openAIToAnthropic.convertError(error, context);
        if (errorResult.success && errorResult.data) {
          return {
            success: false,
            error: {
              type: errorResult.data.error.type,
              message: errorResult.data.error.message
            },
            context
          };
        }
      }

      return {
        success: false,
        error: {
          type: 'api_error',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        },
        context
      };
    }
  }

  /**
   * Process streaming request
   */
  async processStreamingRequest(
    anthropicRequest: AnthropicRequest,
    userAgent?: string,
    ipAddress?: string
  ): Promise<ConversionResult<AsyncIterable<string>>> {
    const requestId = generateRequestId();
    const startTime = Date.now();
    
    const context: ConversionContext = {
      requestId,
      timestamp: getCurrentTimestamp(),
      userAgent,
      ipAddress,
      apiVersion: anthropicRequest.anthropic_version,
      metadata: anthropicRequest.metadata
    };

    // Track metrics
    this.startMetrics(requestId, anthropicRequest.model, startTime);

    try {
      // Convert Anthropic request to OpenAI format
      const conversionResult = await this.anthropicToOpenAI.convertRequest(
        anthropicRequest,
        context
      );

      if (!conversionResult.success || !conversionResult.data) {
        this.updateMetrics(requestId, 'error', conversionResult.error?.type);
        return {
          success: false,
          error: conversionResult.error,
          context
        };
      }

      // Create streaming request to OpenAI
      const openAIStream = await this.openAIService.createStreamingChatCompletion(
        conversionResult.data,
        context
      );

      // Convert streaming response to Anthropic format
      const anthropicStream = await this.openAIToAnthropic.processStreamingResponse(
        openAIStream,
        context,
        anthropicRequest.model
      );

      return {
        success: true,
        data: anthropicStream,
        context
      };

    } catch (error) {
      this.updateMetrics(requestId, 'error', 'api_error');

      return {
        success: false,
        error: {
          type: 'api_error',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        },
        context
      };
    }
  }

  /**
   * Get supported models list
   */
  async getSupportedModels(): Promise<{ models: string[]; total: number }> {
    const models = Object.keys(this.anthropicToOpenAI['modelMapping']);
    return {
      models,
      total: models.length
    };
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'unhealthy';
    openai: { status: 'up' | 'down'; responseTime?: number };
    metrics: { activeRequests: number; totalRequests: number };
  }> {
    const openaiHealth = await this.openAIService.testConnection();
    const activeRequests = Array.from(this.metrics.values()).filter(m => m.status === 'pending').length;
    const totalRequests = this.metrics.size;

    return {
      status: openaiHealth.success ? 'healthy' : 'unhealthy',
      openai: {
        status: openaiHealth.success ? 'up' : 'down',
        responseTime: openaiHealth.responseTime
      },
      metrics: {
        activeRequests,
        totalRequests
      }
    };
  }

  /**
   * Get request metrics
   */
  getMetrics(): RequestMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Clear old metrics (cleanup)
   */
  clearOldMetrics(maxAge: number = 3600000): void { // 1 hour default
    const cutoff = Date.now() - maxAge;
    
    for (const [requestId, metrics] of this.metrics.entries()) {
      if (metrics.startTime < cutoff) {
        this.metrics.delete(requestId);
      }
    }
  }

  /**
   * Start tracking metrics for a request
   */
  private startMetrics(requestId: string, model: string, startTime: number): void {
    this.metrics.set(requestId, {
      requestId,
      startTime,
      model,
      status: 'pending'
    });
  }

  /**
   * Update metrics when request completes
   */
  private updateMetrics(
    requestId: string,
    status: 'success' | 'error',
    errorType?: string,
    inputTokens?: number,
    outputTokens?: number
  ): void {
    const metrics = this.metrics.get(requestId);
    if (metrics) {
      const endTime = Date.now();
      metrics.endTime = endTime;
      metrics.duration = endTime - metrics.startTime;
      metrics.status = status;
      metrics.errorType = errorType;
      metrics.inputTokens = inputTokens;
      metrics.outputTokens = outputTokens;
    }
  }

  /**
   * Check if error is from OpenAI API
   */
  private isOpenAIError(error: any): boolean {
    return error && error.error && typeof error.error.message === 'string';
  }
}