import { logger } from '../utils/helpers.js';
import { OpenAIResponse, OpenAIChoice, OpenAIToolCall, OpenAIMessage } from '../types/openai.js';
import { AnthropicResponse, AnthropicContent, AnthropicUsage, AnthropicToolUseContent, AnthropicTextContent, AnthropicStopReason } from '../types/anthropic.js';

export class OpenAIToAnthropicResponseConverter {
  
  /**
   * 将OpenAI响应转换为Anthropic格式
   */
  convertResponse(
    openaiResponse: OpenAIResponse, 
    originalModel: string,
    requestId: string
  ): AnthropicResponse {
    const choice = openaiResponse.choices[0];
    
    if (!choice) {
      logger.error('No choices found in OpenAI response', { requestId, openaiResponse });
      throw new Error('Invalid OpenAI response: no choices available');
    }

    // 记录响应转换信息
    logger.info('Converting OpenAI response to Anthropic format', {
      requestId,
      originalModel,
      qwenModel: openaiResponse.model,
      inputTokens: openaiResponse.usage?.prompt_tokens || 0,
      outputTokens: openaiResponse.usage?.completion_tokens || 0,
      finishReason: choice.finish_reason,
      responseId: openaiResponse.id
    });

    // 生成Anthropic风格的消息ID
    const anthropicMessageId = `msg_${this.generateRandomString(24)}`;

    // 转换内容块（文本和工具调用）
    const content = this.convertResponseContent(choice.message, requestId);

    const anthropicResponse: AnthropicResponse = {
      id: anthropicMessageId,
      type: 'message',
      role: 'assistant',
      content,
      model: originalModel, // 返回客户端原始请求的模型
      stop_reason: this.convertFinishReason(choice.finish_reason),
      usage: {
        input_tokens: openaiResponse.usage?.prompt_tokens || 0,
        output_tokens: openaiResponse.usage?.completion_tokens || 0
      }
    };

    logger.debug('Response conversion completed', {
      requestId,
      anthropicMessageId,
      contentLength: choice.message.content?.length || 0,
      stopReason: anthropicResponse.stop_reason
    });

    return anthropicResponse;
  }

  /**
   * 转换响应内容（文本和工具调用）
   */
  private convertResponseContent(message: OpenAIMessage, requestId: string): AnthropicContent[] {
    const content: AnthropicContent[] = [];

    // 添加文本内容
    if (message.content) {
      const textContent: AnthropicTextContent = {
        type: 'text',
        text: message.content
      };
      content.push(textContent);
    }

    // 添加工具调用
    if (message.tool_calls && message.tool_calls.length > 0) {
      logger.debug('Converting tool calls to Anthropic format', {
        requestId,
        toolCallCount: message.tool_calls.length
      });

      for (const toolCall of message.tool_calls) {
        if (toolCall.type === 'function') {
          try {
            const input = JSON.parse(toolCall.function.arguments);
            const toolUseContent: AnthropicToolUseContent = {
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.function.name,
              input
            };
            content.push(toolUseContent);

            logger.debug('Converted tool call', {
              requestId,
              toolCallId: toolCall.id,
              toolName: toolCall.function.name
            });
          } catch (error) {
            logger.error('Failed to parse tool call arguments', {
              requestId,
              toolCallId: toolCall.id,
              arguments: toolCall.function.arguments,
              error: error instanceof Error ? error.message : String(error)
            });

            // Add as text content with error information
            const errorText: AnthropicTextContent = {
              type: 'text',
              text: `Error: Invalid tool call arguments for ${toolCall.function.name}`
            };
            content.push(errorText);
          }
        } else {
          logger.warn('Unknown tool call type', {
            requestId,
            toolCallType: (toolCall as any).type,
            toolCallId: toolCall.id
          });
        }
      }
    }

    // 确保至少有一个内容块
    if (content.length === 0) {
      content.push({
        type: 'text',
        text: ''
      });
    }

    return content;
  }

  /**
   * 转换流式响应块
   */
  convertStreamChunk(
    openaiChunk: any,
    originalModel: string,
    requestId: string,
    isFirst: boolean = false
  ): string[] {
    const chunks: string[] = [];

    try {
      // 处理流式响应的第一个块
      if (isFirst) {
        const messageStartEvent = {
          type: 'message_start',
          message: {
            id: `msg_${this.generateRandomString(24)}`,
            type: 'message',
            role: 'assistant',
            content: [],
            model: originalModel,
            usage: {
              input_tokens: 0,
              output_tokens: 0
            }
          }
        };

        const contentBlockStartEvent = {
          type: 'content_block_start',
          index: 0,
          content_block: {
            type: 'text',
            text: ''
          }
        };

        chunks.push(`event: message_start\\ndata: ${JSON.stringify(messageStartEvent)}\\n\\n`);
        chunks.push(`event: content_block_start\\ndata: ${JSON.stringify(contentBlockStartEvent)}\\n\\n`);
      }

      // 处理内容增量
      const choice = openaiChunk.choices?.[0];
      if (choice?.delta?.content) {
        const deltaEvent = {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'text_delta',
            text: choice.delta.content
          }
        };

        chunks.push(`event: content_block_delta\\ndata: ${JSON.stringify(deltaEvent)}\\n\\n`);
      }

      // 处理结束信号
      if (choice?.finish_reason) {
        const contentBlockStopEvent = {
          type: 'content_block_stop',
          index: 0
        };

        const messageDeltaEvent = {
          type: 'message_delta',
          delta: {
            stop_reason: this.convertFinishReason(choice.finish_reason),
            usage: openaiChunk.usage ? {
              output_tokens: openaiChunk.usage.completion_tokens || 0
            } : undefined
          }
        };

        const messageStopEvent = {
          type: 'message_stop'
        };

        chunks.push(`event: content_block_stop\\ndata: ${JSON.stringify(contentBlockStopEvent)}\\n\\n`);
        chunks.push(`event: message_delta\\ndata: ${JSON.stringify(messageDeltaEvent)}\\n\\n`);
        chunks.push(`event: message_stop\\ndata: ${JSON.stringify(messageStopEvent)}\\n\\n`);
      }

    } catch (error) {
      logger.error('Error converting stream chunk', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        chunk: openaiChunk
      });
    }

    return chunks;
  }

  /**
   * 转换结束原因
   */
  private convertFinishReason(reason: string): AnthropicStopReason {
    const mapping: Record<string, AnthropicStopReason> = {
      'stop': 'end_turn',
      'length': 'max_tokens',
      'tool_calls': 'tool_use',
      'content_filter': 'stop_sequence',
      'function_call': 'tool_use'
    };
    
    const converted = mapping[reason] || 'end_turn';
    
    logger.debug('Converted finish reason', {
      original: reason,
      converted
    });
    
    return converted;
  }

  /**
   * 生成随机字符串
   */
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 处理错误响应
   */
  convertErrorResponse(error: any, originalModel: string, requestId: string): any {
    logger.error('Converting error response to Anthropic format', {
      requestId,
      originalModel,
      error: error.message || error
    });

    return {
      type: 'error',
      error: {
        type: 'api_error',
        message: error.message || 'Unknown error occurred'
      }
    };
  }
}

export const openaiToAnthropicResponseConverter = new OpenAIToAnthropicResponseConverter();