/**
 * Universal Stream Processor
 * Handles streaming responses from different API protocols
 */

import { Request, Response } from 'express';
import { logger, logOriginalResponse, logConvertedResponse } from '@/utils/helpers';
import { openaiToAnthropicResponseConverter } from '@/converters/openai-to-anthropic';
import type { APIProvider } from '@/providers';
import { ProtocolType } from '@/providers';
import { configManager } from '@/config';

/**
 * Stream processing context
 */
export interface StreamContext {
  requestId: string;
  provider: APIProvider;
  originalModel: string;
  startTime: number;
  isFirstChunk: boolean;
  totalOutputTokens: number;
  buffer: string;
}

/**
 * Stream chunk processing result
 */
export interface StreamChunkResult {
  chunks: string[];
  shouldContinue: boolean;
  updateTokens?: number;
}

/**
 * Universal Stream Processor
 * Handles streaming responses from different API providers and protocols
 */
export class StreamProcessor {
  
  /**
   * Process streaming response from any provider
   */
  async processStreamResponse(
    providerResponse: globalThis.Response,
    req: Request,
    res: Response,
    requestId: string,
    startTime: number
  ): Promise<void> {
    if (!req.provider) {
      throw new Error('Provider not available in request context');
    }
    
    const context: StreamContext = {
      requestId,
      provider: req.provider,
      originalModel: req.originalModel || 'unknown',
      startTime,
      isFirstChunk: true,
      totalOutputTokens: 0,
      buffer: ''
    };
    
    try {
      logger.info('Starting stream response processing', {
        requestId,
        provider: context.provider.name,
        protocol: context.provider.protocol
      });
      
      // Set up SSE response headers
      this.setupStreamHeaders(res);
      
      // Send initial connection confirmation
      res.write('event: connected\ndata: {"type": "ping"}\n\n');
      
      // Get stream reader
      const reader = providerResponse.body?.getReader();
      if (!reader) {
        throw new Error('No readable stream available from provider response');
      }
      
      const decoder = new TextDecoder();
      
      // Set up client disconnection detection
      const isConnected = () => !res.destroyed && !res.writableEnded;
      
      try {
        await this.processStreamData(reader, decoder, res, context, isConnected);
      } finally {
        this.releaseStreamReader(reader);
      }
      
      // Log completion
      this.logStreamCompletion(context);
      
      // Ensure proper connection closure
      this.closeStreamConnection(res);
      
    } catch (error) {
      await this.handleStreamError(error, res, context);
    }
  }
  
  /**
   * Set up streaming response headers
   */
  private setupStreamHeaders(res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      'Transfer-Encoding': 'chunked'
    });
  }
  
  /**
   * Process stream data with protocol-specific handling
   */
  private async processStreamData(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
    res: Response,
    context: StreamContext,
    isConnected: () => boolean
  ): Promise<void> {
    
    while (isConnected()) {
      const { done, value } = await reader.read();
      
      if (done) {
        logger.info('Stream reading completed', {
          requestId: context.requestId,
          totalOutputTokens: context.totalOutputTokens
        });
        break;
      }
      
      if (!isConnected()) break;
      
      // Decode chunk
      const chunk = decoder.decode(value, { stream: true });
      context.buffer += chunk;
      
      // Process complete lines
      const processResult = await this.processBufferLines(context, res, isConnected);
      
      if (!processResult.shouldContinue) {
        break;
      }
    }
    
    // Process any remaining buffer data
    await this.processRemainingBuffer(context, res, isConnected);
  }
  
  /**
   * Process complete lines from buffer
   */
  private async processBufferLines(
    context: StreamContext,
    res: Response,
    isConnected: () => boolean
  ): Promise<{ shouldContinue: boolean }> {
    
    const lines = context.buffer.split('\n');
    context.buffer = lines.pop() || ''; // Keep incomplete line
    
    for (const line of lines) {
      if (!isConnected()) {
        return { shouldContinue: false };
      }
      
      if (line.startsWith('data: ')) {
        const success = await this.processDataLine(line, context, res);
        if (!success) {
          return { shouldContinue: false };
        }
      }
    }
    
    return { shouldContinue: true };
  }
  
  /**
   * Process a single data line from the stream
   */
  private async processDataLine(
    line: string,
    context: StreamContext,
    res: Response
  ): Promise<boolean> {
    
    const data = line.slice(6).trim(); // Remove 'data: ' prefix
    
    // Handle stream completion
    if (data === '[DONE]') {
      res.write('data: [DONE]\n\n');
      logger.info('Stream completed with [DONE]', { requestId: context.requestId });
      return false;
    }
    
    // Skip empty data
    if (!data) return true;
    
    try {
      // Parse and process chunk based on protocol
      const chunkResult = await this.processStreamChunk(data, context);
      
      // Write processed chunks to response
      for (const processedChunk of chunkResult.chunks) {
        res.write(processedChunk);
      }
      
      // Update token count if available
      if (chunkResult.updateTokens !== undefined) {
        context.totalOutputTokens = chunkResult.updateTokens;
      }
      
      context.isFirstChunk = false;
      return chunkResult.shouldContinue;
      
    } catch (parseError) {
      logger.warn('Failed to parse stream chunk', {
        requestId: context.requestId,
        chunk: data.substring(0, 200), // Limit log length
        error: parseError instanceof Error ? parseError.message : String(parseError)
      });
      return true; // Continue processing despite parse errors
    }
  }
  
  /**
   * Process stream chunk based on provider protocol
   */
  private async processStreamChunk(
    data: string,
    context: StreamContext
  ): Promise<StreamChunkResult> {
    
    // Parse the chunk data
    const chunkData = JSON.parse(data);
    
    // 记录原始流式块（仅在启用verbose时）
    this.logOriginalStreamChunk(context.requestId, chunkData);
    
    // Protocol-specific processing
    let result: StreamChunkResult;
    switch (context.provider.protocol) {
      case ProtocolType.OPENAI:
        result = this.processOpenAIStreamChunk(chunkData, context);
        break;
      
      case ProtocolType.GEMINI:
        result = this.processGeminiStreamChunk(chunkData, context);
        break;
      
      case ProtocolType.ANTHROPIC:
        result = this.processAnthropicStreamChunk(chunkData, context);
        break;
      
      default:
        // Default to OpenAI format for unknown protocols
        logger.warn('Unknown protocol, defaulting to OpenAI processing', {
          protocol: context.provider.protocol,
          provider: context.provider.name
        });
        result = this.processOpenAIStreamChunk(chunkData, context);
    }
    
    // 记录转换后的流式块（仅在启用verbose时）
    this.logConvertedStreamChunk(context.requestId, result.chunks);
    
    return result;
  }
  
  /**
   * Process OpenAI protocol stream chunk
   */
  private processOpenAIStreamChunk(
    chunkData: any,
    context: StreamContext
  ): StreamChunkResult {
    
    // Convert OpenAI chunk to Anthropic format
    const anthropicChunks = openaiToAnthropicResponseConverter.convertStreamChunk(
      chunkData,
      context.originalModel,
      context.requestId,
      context.isFirstChunk
    );
    
    // Extract token usage if available
    let updateTokens: number | undefined;
    if (chunkData.usage?.completion_tokens) {
      updateTokens = chunkData.usage.completion_tokens;
    }
    
    return {
      chunks: anthropicChunks,
      shouldContinue: true,
      updateTokens
    };
  }
  
  /**
   * Process Gemini protocol stream chunk (placeholder for future implementation)
   */
  private processGeminiStreamChunk(
    chunkData: any,
    context: StreamContext
  ): StreamChunkResult {
    
    logger.debug('Processing Gemini stream chunk', {
      requestId: context.requestId,
      chunkKeys: Object.keys(chunkData)
    });
    
    // TODO: Implement Gemini-specific chunk processing
    // For now, attempt to adapt to OpenAI format
    const adaptedChunk = this.adaptGeminiToOpenAI(chunkData);
    return this.processOpenAIStreamChunk(adaptedChunk, context);
  }
  
  /**
   * Process Anthropic protocol stream chunk (placeholder for future implementation)
   */
  private processAnthropicStreamChunk(
    chunkData: any,
    context: StreamContext
  ): StreamChunkResult {
    
    logger.debug('Processing Anthropic stream chunk', {
      requestId: context.requestId,
      chunkKeys: Object.keys(chunkData)
    });
    
    // TODO: Implement native Anthropic chunk processing
    // For now, assume it's already in correct format
    return {
      chunks: [`data: ${JSON.stringify(chunkData)}\n\n`],
      shouldContinue: true
    };
  }
  
  /**
   * Adapt Gemini format to OpenAI (placeholder)
   */
  private adaptGeminiToOpenAI(geminiChunk: any): any {
    // TODO: Implement Gemini to OpenAI adaptation
    return geminiChunk;
  }
  
  /**
   * Process remaining buffer data
   */
  private async processRemainingBuffer(
    context: StreamContext,
    res: Response,
    isConnected: () => boolean
  ): Promise<void> {
    
    if (!context.buffer.trim() || !isConnected()) return;
    
    if (context.buffer.startsWith('data: ')) {
      const data = context.buffer.slice(6).trim();
      if (data && data !== '[DONE]') {
        try {
          const chunkResult = await this.processStreamChunk(data, context);
          for (const processedChunk of chunkResult.chunks) {
            res.write(processedChunk);
          }
        } catch (parseError) {
          logger.warn('Failed to parse final buffer chunk', {
            requestId: context.requestId,
            error: parseError instanceof Error ? parseError.message : String(parseError)
          });
        }
      }
    }
  }
  
  /**
   * Release stream reader safely
   */
  private releaseStreamReader(reader: ReadableStreamDefaultReader<Uint8Array>): void {
    try {
      reader.releaseLock();
    } catch (error) {
      // Ignore release errors - they're usually harmless
      logger.debug('Stream reader release warning', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Log stream completion
   */
  private logStreamCompletion(context: StreamContext): void {
    const duration = Date.now() - context.startTime;
    
    logger.info('Stream processing completed', {
      requestId: context.requestId,
      provider: context.provider.name,
      protocol: context.provider.protocol,
      duration,
      totalOutputTokens: context.totalOutputTokens
    });
  }
  
  /**
   * Close stream connection properly
   */
  private closeStreamConnection(res: Response): void {
    if (!res.destroyed && !res.writableEnded) {
      res.end();
    }
  }
  
  /**
   * Handle stream processing errors
   */
  private async handleStreamError(
    error: any,
    res: Response,
    context: StreamContext
  ): Promise<void> {
    
    const duration = Date.now() - context.startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('Error during stream processing', {
      requestId: context.requestId,
      provider: context.provider?.name,
      protocol: context.provider?.protocol,
      duration,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    if (!res.headersSent) {
      res.status(500).json({
        type: 'error',
        error: {
          type: 'stream_processing_error',
          message: 'Error occurred during streaming response processing'
        }
      });
    } else if (!res.destroyed && !res.writableEnded) {
      // Send error event in stream format
      res.write(`event: error\ndata: ${JSON.stringify({
        type: 'error',
        error: {
          type: 'stream_processing_error',
          message: 'Stream processing error occurred'
        }
      })}\n\n`);
      res.end();
    }
  }
  
  /**
   * 记录原始流式块（来自API提供商）
   */
  private logOriginalStreamChunk(requestId: string, chunkData: any): void {
    try {
      const config = configManager.getConfig();
      if (!config.logging.verboseMessages) return;
      
      logger.info('Original stream chunk (from API provider)', {
        requestId,
        chunkData: {
          id: chunkData.id,
          object: chunkData.object,
          created: chunkData.created,
          model: chunkData.model,
          choices: chunkData.choices?.map((choice: any) => ({
            index: choice.index,
            delta: choice.delta,
            finishReason: choice.finish_reason
          })),
          usage: chunkData.usage
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // 静默失败，不影响流处理
    }
  }
  
  /**
   * 记录转换后的流式块（Anthropic格式）
   */
  private logConvertedStreamChunk(requestId: string, chunks: string[]): void {
    try {
      const config = configManager.getConfig();
      if (!config.logging.verboseMessages) return;
      
      logger.info('Converted stream chunks (to Anthropic format)', {
        requestId,
        chunkCount: chunks.length,
        chunks: chunks.map(chunk => {
          try {
            // 提取data部分并解析
            const dataMatch = chunk.match(/data: (.*?)\n/);
            if (dataMatch && dataMatch[1] && dataMatch[1] !== '[DONE]') {
              return JSON.parse(dataMatch[1]);
            }
            return { raw: chunk.trim() };
          } catch {
            return { raw: chunk.substring(0, 100) + '...' };
          }
        }),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // 静默失败，不影响流处理
    }
  }
}

// Export singleton instance
export const streamProcessor = new StreamProcessor();