/**
 * Anthropic to OpenAI Request Converter
 * Converts Anthropic API requests to OpenAI API format
 */

import { logger, extractTextFromContent } from '../utils/helpers.js';
import { AnthropicTool, AnthropicRequest, AnthropicMessage, AnthropicContent, AnthropicToolUseContent, AnthropicToolResultContent } from '../types/anthropic.js';
import { OpenAITool, OpenAIRequest, OpenAIMessage, OpenAIToolChoice } from '../types/openai.js';

// 删除本地类型定义，使用导入的类型

export class AnthropicToOpenAIConverter {
  private readonly targetModel = 'qwen3-coder-plus';

  /**
   * 将Anthropic请求转换为OpenAI格式
   */
  convertRequest(anthropicRequest: AnthropicRequest, requestId: string): OpenAIRequest {
    // 记录原始模型信息到日志
    logger.info('Converting Anthropic request to OpenAI format', {
      requestId,
      originalModel: anthropicRequest.model,
      targetModel: this.targetModel,
      messageCount: anthropicRequest.messages?.length || 0,
      maxTokens: anthropicRequest.max_tokens,
      temperature: anthropicRequest.temperature,
      stream: anthropicRequest.stream
    });

    const openaiRequest: OpenAIRequest = {
      model: this.targetModel, // 固定使用qwen3-coder-plus模型
      messages: this.convertMessages(anthropicRequest.messages, requestId),
      max_tokens: anthropicRequest.max_tokens,
      temperature: anthropicRequest.temperature,
      stream: anthropicRequest.stream,
      stop: anthropicRequest.stop_sequences,
      top_p: anthropicRequest.top_p,
      tools: this.convertTools(anthropicRequest.tools, requestId),
      tool_choice: this.convertToolChoice(anthropicRequest.tool_choice, requestId)
    };

    // 移除undefined值
    Object.keys(openaiRequest).forEach(key => {
      if (openaiRequest[key as keyof OpenAIRequest] === undefined) {
        delete openaiRequest[key as keyof OpenAIRequest];
      }
    });

    logger.debug('Request conversion completed', {
      requestId,
      convertedMessageCount: openaiRequest.messages.length
    });

    return openaiRequest;
  }

  /**
   * 转换消息数组
   */
  private convertMessages(messages: AnthropicMessage[], requestId: string): OpenAIMessage[] {
    if (!Array.isArray(messages)) {
      logger.warn('Invalid messages format, expected array', { requestId, messagesType: typeof messages });
      return [];
    }

    const openaiMessages: OpenAIMessage[] = [];

    messages.forEach((msg, index) => {
      const convertedMessages = this.convertMessage(msg, requestId, index);
      openaiMessages.push(...convertedMessages);
    });

    return openaiMessages;
  }

  /**
   * 转换单个消息，可能产生多个OpenAI消息
   */
  private convertMessage(message: AnthropicMessage, requestId: string, messageIndex: number): OpenAIMessage[] {
    if (typeof message.content === 'string') {
      return [{
        role: message.role,
        content: message.content
      }];
    }

    if (!Array.isArray(message.content)) {
      logger.warn('Invalid message content format', {
        requestId,
        messageIndex,
        contentType: typeof message.content
      });
      return [{
        role: message.role,
        content: ''
      }];
    }

    const messages: OpenAIMessage[] = [];
    let currentMessage: OpenAIMessage = {
      role: message.role,
      content: null
    };
    const textParts: string[] = [];
    const toolCalls: any[] = [];

    for (const contentBlock of message.content) {
      switch (contentBlock.type) {
        case 'text':
          textParts.push(contentBlock.text);
          break;
        case 'tool_use':
          const toolUse = contentBlock as AnthropicToolUseContent;
          toolCalls.push({
            id: toolUse.id,
            type: 'function',
            function: {
              name: toolUse.name,
              arguments: JSON.stringify(toolUse.input)
            }
          });
          break;
        case 'tool_result':
          // Tool results need to be converted to separate messages
          const toolResult = contentBlock as AnthropicToolResultContent;
          if (currentMessage.content !== null || toolCalls.length > 0) {
            // Finish current message first
            if (textParts.length > 0) {
              currentMessage.content = textParts.join('');
            }
            if (toolCalls.length > 0) {
              currentMessage.tool_calls = toolCalls;
            }
            messages.push(currentMessage);
            
            // Reset for next message
            currentMessage = {
              role: message.role,
              content: null
            };
            textParts.length = 0;
            toolCalls.length = 0;
          }
          
          // Add tool result as separate message
          messages.push({
            role: 'tool',
            content: typeof toolResult.content === 'string' 
              ? toolResult.content 
              : JSON.stringify(toolResult.content),
            tool_call_id: toolResult.tool_use_id
          });
          break;
        case 'image':
          logger.warn('Image content not supported in OpenAI conversion', {
            requestId,
            messageIndex
          });
          break;
        default:
          logger.warn('Unknown content block type', {
            requestId,
            messageIndex,
            contentType: (contentBlock as any).type
          });
      }
    }

    // Add final message if it has content
    if (textParts.length > 0 || toolCalls.length > 0) {
      if (textParts.length > 0) {
        currentMessage.content = textParts.join('');
      }
      if (toolCalls.length > 0) {
        currentMessage.tool_calls = toolCalls;
      }
      messages.push(currentMessage);
    } else if (messages.length === 0) {
      // Ensure we always return at least one message
      messages.push({
        role: message.role,
        content: ''
      });
    }

    return messages;
  }



  /**
   * 转换工具定义
   */
  private convertTools(tools: AnthropicTool[] | undefined, requestId: string): OpenAITool[] | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    logger.debug('Converting tools', {
      requestId,
      toolCount: tools.length,
      toolNames: tools.map(tool => tool.name)
    });

    return tools.map(tool => {
      const openaiTool: OpenAITool = {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        }
      };

      logger.debug('Converted tool', {
        requestId,
        toolName: tool.name,
        hasParameters: !!tool.input_schema
      });

      return openaiTool;
    });
  }

  /**
   * 转换工具选择策略
   */
  private convertToolChoice(toolChoice: AnthropicRequest['tool_choice'], requestId: string): OpenAIToolChoice | undefined {
    if (!toolChoice) {
      return undefined;
    }

    logger.debug('Converting tool choice', {
      requestId,
      toolChoiceType: toolChoice.type,
      toolChoiceName: toolChoice.name
    });

    switch (toolChoice.type) {
      case 'auto':
        return 'auto';
      case 'any':
        // OpenAI doesn't have 'any' equivalent, fallback to 'auto'
        logger.warn('Converting Anthropic tool_choice "any" to OpenAI "auto"', { requestId });
        return 'auto';
      case 'tool':
        if (toolChoice.name) {
          return {
            type: 'function',
            function: {
              name: toolChoice.name
            }
          };
        } else {
          logger.warn('Tool choice type "tool" specified without name, fallback to "auto"', { requestId });
          return 'auto';
        }
      default:
        logger.warn('Unknown tool choice type, fallback to "auto"', {
          requestId,
          toolChoiceType: (toolChoice as any).type
        });
        return 'auto';
    }
  }

  /**
   * 验证请求格式
   */
  validateRequest(request: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.model) {
      errors.push('Missing required field: model');
    }

    if (!request.max_tokens) {
      errors.push('Missing required field: max_tokens');
    }

    if (!Array.isArray(request.messages)) {
      errors.push('Missing or invalid field: messages (must be array)');
    } else {
      request.messages.forEach((msg: any, index: number) => {
        if (!msg.role) {
          errors.push(`Message ${index}: missing role`);
        }
        if (!msg.content) {
          errors.push(`Message ${index}: missing content`);
        }
        if (msg.role && !['user', 'assistant'].includes(msg.role)) {
          errors.push(`Message ${index}: invalid role '${msg.role}' (must be 'user' or 'assistant')`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export const anthropicToOpenAIConverter = new AnthropicToOpenAIConverter();
