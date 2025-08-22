/**
 * Anthropic to OpenAI Request Converter
 * Converts Anthropic API requests to OpenAI API format
 */

import type {
  AnthropicRequest,
  AnthropicMessage,
  AnthropicContent,
  AnthropicTool,
  OpenAIRequest,
  OpenAIMessage,
  OpenAITool,
  ConversionResult,
  ConversionContext,
  StandardError,
  ModelMapping
} from '@/types/index.js';

import { 
  flattenContentToString,
  validateTemperature,
  hasUnsupportedContent,
  removeUndefined,
  generateRequestId
} from '@/utils/helpers.js';

export class AnthropicToOpenAIConverter {
  private modelMapping: ModelMapping;

  constructor(modelMapping: ModelMapping) {
    this.modelMapping = modelMapping;
  }

  /**
   * Convert Anthropic request to OpenAI format
   */
  async convertRequest(
    anthropicRequest: AnthropicRequest,
    context: ConversionContext
  ): Promise<ConversionResult<OpenAIRequest>> {
    try {
      // Validate required parameters
      const validation = this.validateRequest(anthropicRequest);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error,
          context
        };
      }

      // Check for unsupported features
      const unsupportedCheck = this.checkUnsupportedFeatures(anthropicRequest);
      if (!unsupportedCheck.success) {
        return {
          success: false,
          error: unsupportedCheck.error,
          context
        };
      }

      // Map model
      const modelMapping = this.mapModel(anthropicRequest.model);
      if (!modelMapping) {
        return {
          success: false,
          error: {
            type: 'invalid_request_error',
            message: `Unsupported model: ${anthropicRequest.model}`
          },
          context
        };
      }

      // Convert messages
      const messagesResult = this.convertMessages(anthropicRequest);
      if (!messagesResult.success) {
        return {
          success: false,
          error: messagesResult.error,
          context
        };
      }

      // Convert tools if present
      let tools: OpenAITool[] | undefined;
      let toolChoice: any = undefined;
      
      if (anthropicRequest.tools) {
        const toolsResult = this.convertTools(anthropicRequest.tools);
        if (!toolsResult.success) {
          return {
            success: false,
            error: toolsResult.error,
            context
          };
        }
        tools = toolsResult.data;
        
        // Convert tool choice
        if (anthropicRequest.tool_choice) {
          toolChoice = this.convertToolChoice(anthropicRequest.tool_choice);
        }
      }

      // Build OpenAI request
      const openaiRequest: OpenAIRequest = removeUndefined({
        model: modelMapping.openaiModel,
        messages: messagesResult.data!,
        max_tokens: this.adjustMaxTokens(anthropicRequest.max_tokens, modelMapping),
        temperature: anthropicRequest.temperature ? 
          validateTemperature(anthropicRequest.temperature, 'openai') : undefined,
        top_p: anthropicRequest.top_p,
        stream: anthropicRequest.stream,
        stop: anthropicRequest.stop_sequences,
        tools,
        tool_choice: toolChoice,
        user: anthropicRequest.metadata?.user_id
      });

      return {
        success: true,
        data: openaiRequest,
        context
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'internal_error',
          message: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        context
      };
    }
  }

  /**
   * Validate Anthropic request
   */
  private validateRequest(request: AnthropicRequest): { success: boolean; error?: StandardError } {
    if (!request.model) {
      return {
        success: false,
        error: {
          type: 'invalid_request_error',
          message: 'Missing required parameter: model'
        }
      };
    }

    if (!request.max_tokens || request.max_tokens <= 0) {
      return {
        success: false,
        error: {
          type: 'invalid_request_error',
          message: 'Missing or invalid required parameter: max_tokens'
        }
      };
    }

    if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
      return {
        success: false,
        error: {
          type: 'invalid_request_error',
          message: 'Missing or empty required parameter: messages'
        }
      };
    }

    return { success: true };
  }

  /**
   * Check for unsupported features and return appropriate errors
   */
  private checkUnsupportedFeatures(request: AnthropicRequest): { success: boolean; error?: StandardError } {
    // Check for audio or file content in messages
    for (const message of request.messages) {
      if (Array.isArray(message.content)) {
        const { hasUnsupported, unsupportedTypes } = hasUnsupportedContent(message.content);
        if (hasUnsupported) {
          const typeMessage = unsupportedTypes.includes('input_audio') ? 
            '音频输入功能暂不支持，请使用纯文本输入' :
            '文件上传功能暂不支持，请将文件内容转换为文本后输入';
            
          return {
            success: false,
            error: {
              type: 'not_supported_error',
              message: typeMessage
            }
          };
        }
      }
    }

    return { success: true };
  }

  /**
   * Map Anthropic model to OpenAI model
   */
  private mapModel(anthropicModel: string): ModelMapping[string] | undefined {
    return this.modelMapping[anthropicModel];
  }

  /**
   * Convert Anthropic messages to OpenAI format
   */
  private convertMessages(request: AnthropicRequest): { success: boolean; data?: OpenAIMessage[]; error?: StandardError } {
    try {
      const openaiMessages: OpenAIMessage[] = [];

      // Add system message if present
      if (request.system) {
        // Augment system message with metadata if present
        let systemContent = request.system;
        
        if (request.metadata || request.anthropic_version) {
          systemContent += this.buildContextPrompt(request.metadata, request.anthropic_version);
        }

        openaiMessages.push({
          role: 'system',
          content: systemContent
        });
      }

      // Convert user and assistant messages
      for (const message of request.messages) {
        const convertedMessage = this.convertSingleMessage(message);
        if (!convertedMessage) {
          return {
            success: false,
            error: {
              type: 'invalid_request_error',
              message: 'Failed to convert message'
            }
          };
        }
        openaiMessages.push(convertedMessage);
      }

      return {
        success: true,
        data: openaiMessages
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'internal_error',
          message: `Message conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }

  /**
   * Convert a single Anthropic message to OpenAI format
   */
  private convertSingleMessage(message: AnthropicMessage): OpenAIMessage | null {
    try {
      // Handle tool calls and tool results
      if (Array.isArray(message.content)) {
        const hasToolUse = message.content.some(item => item.type === 'tool_use');
        const hasToolResult = message.content.some(item => item.type === 'tool_result');

        if (hasToolUse && message.role === 'assistant') {
          return this.convertAssistantMessageWithTools(message);
        }

        if (hasToolResult && message.role === 'user') {
          return this.convertUserMessageWithToolResults(message);
        }
      }

      // Regular message conversion
      return {
        role: message.role === 'user' ? 'user' : 'assistant',
        content: flattenContentToString(message.content)
      };

    } catch {
      return null;
    }
  }

  /**
   * Convert assistant message with tool calls
   */
  private convertAssistantMessageWithTools(message: AnthropicMessage): OpenAIMessage {
    const content = Array.isArray(message.content) ? message.content : [];
    const textContent = content
      .filter(item => item.type === 'text')
      .map(item => (item as any).text)
      .join('\n');

    const toolCalls = content
      .filter(item => item.type === 'tool_use')
      .map((item: any) => ({
        id: item.id,
        type: 'function' as const,
        function: {
          name: item.name,
          arguments: JSON.stringify(item.input)
        }
      }));

    return {
      role: 'assistant',
      content: textContent || null,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined
    };
  }

  /**
   * Convert user message with tool results
   */
  private convertUserMessageWithToolResults(message: AnthropicMessage): OpenAIMessage {
    const content = Array.isArray(message.content) ? message.content : [];
    
    // For tool results, we need to create separate tool messages
    // This is a simplified approach - in practice, you might need multiple messages
    const textParts: string[] = [];
    
    for (const item of content) {
      if (item.type === 'text') {
        textParts.push((item as any).text);
      } else if (item.type === 'tool_result') {
        const toolResult = item as any;
        textParts.push(`Tool result: ${typeof toolResult.content === 'string' ? toolResult.content : JSON.stringify(toolResult.content)}`);
      }
    }

    return {
      role: 'user',
      content: textParts.join('\n')
    };
  }

  /**
   * Convert Anthropic tools to OpenAI format
   */
  private convertTools(anthropicTools: AnthropicTool[]): { success: boolean; data?: OpenAITool[]; error?: StandardError } {
    try {
      const openaiTools: OpenAITool[] = anthropicTools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        }
      }));

      return {
        success: true,
        data: openaiTools
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'internal_error',
          message: `Tool conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }

  /**
   * Convert Anthropic tool choice to OpenAI format
   */
  private convertToolChoice(anthropicToolChoice: any): any {
    if (anthropicToolChoice.type === 'auto') {
      return 'auto';
    }
    
    if (anthropicToolChoice.type === 'tool' && anthropicToolChoice.name) {
      return {
        type: 'function',
        function: {
          name: anthropicToolChoice.name
        }
      };
    }

    return 'auto';
  }

  /**
   * Adjust max_tokens for OpenAI limits
   */
  private adjustMaxTokens(maxTokens: number, modelMapping: ModelMapping[string]): number {
    return Math.min(maxTokens, modelMapping.maxTokens);
  }

  /**
   * Build context prompt for metadata
   */
  private buildContextPrompt(metadata?: any, anthropicVersion?: string): string {
    const contextParts: string[] = [];

    if (metadata) {
      const contextInfo: string[] = [];
      
      if (metadata.user_id) {
        contextInfo.push(`用户ID: ${metadata.user_id}`);
      }
      
      if (metadata.session_id) {
        contextInfo.push(`会话ID: ${metadata.session_id}`);
      }
      
      if (metadata.application) {
        contextInfo.push(`应用场景: ${metadata.application}`);
      }
      
      if (metadata.priority) {
        contextInfo.push(`优先级: ${metadata.priority}`);
      }

      if (contextInfo.length > 0) {
        contextParts.push(`\n\n[CONTEXT_INFO: ${contextInfo.join(', ')}]`);
      }
    }

    if (anthropicVersion) {
      contextParts.push(`\n[API_VERSION: 使用${anthropicVersion}版本的响应风格和能力]`);
    }

    return contextParts.join('');
  }
}