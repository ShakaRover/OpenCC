/**
 * Anthropic to OpenAI Request Converter
 * Converts Anthropic API requests to OpenAI API format
 */

import { logger, extractTextFromContent } from '../utils/helpers.js';

// Anthropic API 类型定义
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: 'text'; text: string }>;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  temperature?: number;
  stream?: boolean;
  stop?: string | string[];
  top_p?: number;
  top_k?: number;
}

// OpenAI API 类型定义
interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  stop?: string | string[];
  top_p?: number;
}

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
      stop: anthropicRequest.stop,
      top_p: anthropicRequest.top_p
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

    return messages.map((msg, index) => {
      const convertedContent = this.convertContent(msg.content, requestId, index);
      
      return {
        role: msg.role,
        content: convertedContent
      };
    });
  }

  /**
   * 转换消息内容
   */
  private convertContent(content: string | Array<{ type: 'text'; text: string }>, requestId: string, messageIndex: number): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      const textContent = extractTextFromContent(content);
      
      // 检查是否有非文本内容
      const nonTextBlocks = content.filter(block => block.type !== 'text');
      if (nonTextBlocks.length > 0) {
        logger.warn('Non-text content blocks detected and will be filtered out', {
          requestId,
          messageIndex,
          nonTextBlockTypes: nonTextBlocks.map(block => block.type),
          nonTextBlockCount: nonTextBlocks.length
        });
      }

      return textContent;
    }

    logger.warn('Unexpected content format', {
      requestId,
      messageIndex,
      contentType: typeof content
    });

    return '';
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
