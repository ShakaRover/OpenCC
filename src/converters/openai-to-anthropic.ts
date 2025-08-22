/**
 * OpenAI to Anthropic Response Converter
 * Converts OpenAI API responses to Anthropic API format
 */

import type {
  OpenAIResponse,
  OpenAIStreamChunk,
  OpenAIError,
  AnthropicResponse,
  AnthropicStreamChunk,
  AnthropicError,
  AnthropicContent,
  AnthropicStopReason,
  AnthropicUsage,
  ConversionResult,
  ConversionContext,
  StandardError
} from '@/types/index.js';

import {
  generateAnthropicMessageId,
  getCurrentTimestamp,
  stringToAnthropicContent,
  safeJsonParse
} from '@/utils/helpers.js';

export class OpenAIToAnthropicConverter {
  /**
   * Convert OpenAI response to Anthropic format
   */
  async convertResponse(
    openaiResponse: OpenAIResponse,
    context: ConversionContext,
    originalModel: string
  ): Promise<ConversionResult<AnthropicResponse>> {
    try {
      const choice = openaiResponse.choices[0];
      if (!choice) {
        return {
          success: false,
          error: {
            type: 'api_error',
            message: 'No choices in OpenAI response'
          },
          context
        };
      }

      // Convert content
      const content = this.convertResponseContent(choice.message);

      // Convert usage statistics
      const usage: AnthropicUsage = {
        input_tokens: openaiResponse.usage.prompt_tokens,
        output_tokens: openaiResponse.usage.completion_tokens
      };

      // Convert stop reason
      const stopReason = this.convertFinishReason(choice.finish_reason);

      const anthropicResponse: AnthropicResponse = {
        id: generateAnthropicMessageId(),
        type: 'message',
        role: 'assistant',
        content,
        model: originalModel,
        stop_reason: stopReason,
        usage
      };

      return {
        success: true,
        data: anthropicResponse,
        context
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'internal_error',
          message: `Response conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        context
      };
    }
  }

  /**
   * Convert OpenAI streaming chunk to Anthropic format
   */
  async convertStreamChunk(
    openaiChunk: OpenAIStreamChunk,
    context: ConversionContext,
    originalModel: string,
    isFirst: boolean = false,
    isLast: boolean = false
  ): Promise<ConversionResult<AnthropicStreamChunk[]>> {
    try {
      const chunks: AnthropicStreamChunk[] = [];

      // Handle first chunk - send message_start
      if (isFirst) {
        chunks.push({
          type: 'message_start',
          message: {
            id: generateAnthropicMessageId(),
            type: 'message',
            role: 'assistant',
            content: [],
            model: originalModel,
            usage: {
              input_tokens: 0,
              output_tokens: 0
            }
          }
        });

        chunks.push({
          type: 'content_block_start',
          index: 0,
          content_block: {
            type: 'text',
            text: ''
          }
        });
      }

      // Handle content delta
      const choice = openaiChunk.choices[0];
      if (choice && choice.delta.content) {
        chunks.push({
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'text_delta',
            text: choice.delta.content
          }
        });
      }

      // Handle tool calls if present
      if (choice && choice.delta.tool_calls) {
        for (const toolCall of choice.delta.tool_calls) {
          if (toolCall.function?.name) {
            chunks.push({
              type: 'content_block_start',
              index: chunks.length,
              content_block: {
                type: 'tool_use'
              }
            });
          }
        }
      }

      // Handle completion
      if (choice && choice.finish_reason) {
        chunks.push({
          type: 'content_block_stop',
          index: 0
        });

        chunks.push({
          type: 'message_delta',
          delta: {
            stop_reason: this.convertFinishReason(choice.finish_reason),
            usage: openaiChunk.usage ? {
              output_tokens: openaiChunk.usage.completion_tokens
            } : undefined
          }
        });

        chunks.push({
          type: 'message_stop'
        });
      }

      return {
        success: true,
        data: chunks,
        context
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'internal_error',
          message: `Stream chunk conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        context
      };
    }
  }

  /**
   * Convert OpenAI error to Anthropic format
   */
  async convertError(
    openaiError: OpenAIError,
    context: ConversionContext
  ): Promise<ConversionResult<AnthropicError>> {
    try {
      const anthropicError: AnthropicError = {
        type: 'error',
        error: {
          type: this.mapErrorType(openaiError.error.type),
          message: openaiError.error.message
        }
      };

      return {
        success: true,
        data: anthropicError,
        context
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'internal_error',
          message: `Error conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        context
      };
    }
  }

  /**
   * Convert OpenAI message content to Anthropic content array
   */
  private convertResponseContent(message: any): AnthropicContent[] {
    const content: AnthropicContent[] = [];

    // Add text content if present
    if (message.content) {
      content.push({
        type: 'text',
        text: message.content
      });
    }

    // Add tool calls if present
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      for (const toolCall of message.tool_calls) {
        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: safeJsonParse(toolCall.function.arguments, {})
        });
      }
    }

    // If no content, add empty text block
    if (content.length === 0) {
      content.push({
        type: 'text',
        text: ''
      });
    }

    return content;
  }

  /**
   * Convert OpenAI finish_reason to Anthropic stop_reason
   */
  private convertFinishReason(finishReason: string): AnthropicStopReason {
    switch (finishReason) {
      case 'stop':
        return 'end_turn';
      case 'length':
        return 'max_tokens';
      case 'tool_calls':
        return 'tool_use';
      case 'content_filter':
        return 'end_turn';
      default:
        return 'end_turn';
    }
  }

  /**
   * Map OpenAI error types to Anthropic error types
   */
  private mapErrorType(openaiErrorType: string): AnthropicError['error']['type'] {
    switch (openaiErrorType) {
      case 'invalid_request_error':
        return 'invalid_request_error';
      case 'authentication_error':
        return 'authentication_error';
      case 'rate_limit_error':
        return 'rate_limit_error';
      case 'api_error':
      case 'server_error':
        return 'api_error';
      default:
        return 'api_error';
    }
  }

  /**
   * Create stream data format for SSE
   */
  createStreamData(chunk: AnthropicStreamChunk): string {
    return `data: ${JSON.stringify(chunk)}\n\n`;
  }

  /**
   * Create stream end marker
   */
  createStreamEnd(): string {
    return 'data: [DONE]\n\n';
  }

  /**
   * Process and format streaming response
   */
  async processStreamingResponse(
    openaiChunks: AsyncIterable<string>,
    context: ConversionContext,
    originalModel: string
  ): Promise<AsyncIterable<string>> {
    const converter = this;
    
    return {
      async *[Symbol.asyncIterator]() {
        let isFirst = true;
        let buffer = '';
        
        try {
          for await (const chunk of openaiChunks) {
            buffer += chunk;
            
            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.substring(6).trim();
                
                if (data === '[DONE]') {
                  yield converter.createStreamEnd();
                  return;
                }
                
                if (data) {
                  try {
                    const openaiChunk = JSON.parse(data) as OpenAIStreamChunk;
                    const result = await converter.convertStreamChunk(
                      openaiChunk,
                      context,
                      originalModel,
                      isFirst
                    );
                    
                    if (result.success && result.data) {
                      for (const anthropicChunk of result.data) {
                        yield converter.createStreamData(anthropicChunk);
                      }
                    }
                    
                    isFirst = false;
                  } catch (parseError) {
                    // Skip invalid JSON chunks
                    console.warn('Failed to parse streaming chunk:', parseError);
                  }
                }
              }
            }
          }
        } catch (error) {
          // Send error in Anthropic format
          const errorChunk: AnthropicStreamChunk = {
            type: 'message_stop'
          };
          yield converter.createStreamData(errorChunk);
        }
      }
    };
  }
}