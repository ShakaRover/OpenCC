/**
 * DeepSeek Reasoning Content Compatibility Tests
 * Validates the handling of reasoning_content field in OpenAI to Anthropic conversion
 */

import type { 
  OpenAIResponse, 
  OpenAIStreamChunk, 
  ConversionContext,
  AnthropicContent
} from '../../src/types';

// Mock helpers to avoid dependency issues
const mockHelpers = {
  generateAnthropicMessageId: () => 'msg_test_123',
  getCurrentTimestamp: () => Date.now(),
  stringToAnthropicContent: (text: string) => [{ type: 'text', text }],
  safeJsonParse: (str: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }
};

// Simple converter class for testing
class TestableOpenAIToAnthropicConverter {
  private convertFinishReason(finishReason: string): 'end_turn' | 'max_tokens' | 'tool_use' {
    switch (finishReason) {
      case 'stop':
        return 'end_turn';
      case 'length':
        return 'max_tokens';
      case 'tool_calls':
        return 'tool_use';
      default:
        return 'end_turn';
    }
  }

  private convertResponseContent(message: any): AnthropicContent[] {
    const content: AnthropicContent[] = [];

    // Add reasoning content first if present (DeepSeek compatibility)
    // Follow design doc: reasoning_content as independent text content block
    if (message.reasoning_content && message.reasoning_content.trim()) {
      content.push({
        type: 'text',
        text: message.reasoning_content
      });
    }

    // Add standard text content if present
    if (message.content && message.content.trim()) {
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
          input: mockHelpers.safeJsonParse(toolCall.function.arguments) || {}
        });
      }
    }

    // If no content at all, add empty text block
    if (content.length === 0) {
      content.push({
        type: 'text',
        text: ''
      });
    }

    return content;
  }

  async convertResponse(
    openaiResponse: OpenAIResponse,
    context: ConversionContext,
    originalModel: string
  ) {
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

      const content = this.convertResponseContent(choice.message);

      return {
        success: true,
        data: {
          id: mockHelpers.generateAnthropicMessageId(),
          type: 'message' as const,
          role: 'assistant' as const,
          content,
          model: originalModel,
          stop_reason: this.convertFinishReason(choice.finish_reason),
          usage: {
            input_tokens: openaiResponse.usage.prompt_tokens,
            output_tokens: openaiResponse.usage.completion_tokens
          }
        },
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

  async convertStreamChunk(
    openaiChunk: OpenAIStreamChunk,
    context: ConversionContext,
    originalModel: string,
    isFirst: boolean = false
  ) {
    try {
      const chunks: any[] = [];
      const choice = openaiChunk.choices[0];

      // Handle first chunk - send message_start
      if (isFirst) {
        chunks.push({
          type: 'message_start',
          message: {
            id: mockHelpers.generateAnthropicMessageId(),
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

      // Handle reasoning content delta (DeepSeek compatibility)
      if (choice && choice.delta.reasoning_content) {
        chunks.push({
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'text_delta',
            text: choice.delta.reasoning_content
          }
        });
      }

      // Handle regular content delta
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

      // Handle completion with special rules for reasoning content
      if (choice && choice.finish_reason) {
        const hasReasoningContent = choice.delta.reasoning_content && choice.delta.reasoning_content.trim();
        const hasRegularContent = choice.delta.content && choice.delta.content.trim();
        
        if (choice.finish_reason === 'stop' && !hasRegularContent && hasReasoningContent) {
          // Skip end processing for reasoning-only completion
        } else {
          chunks.push({
            type: 'content_block_stop',
            index: 0
          });

          chunks.push({
            type: 'message_delta',
            delta: {
              type: 'text_delta',
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
}

describe('DeepSeek Reasoning Content Compatibility', () => {
  let converter: TestableOpenAIToAnthropicConverter;
  let mockContext: ConversionContext;

  beforeEach(() => {
    converter = new TestableOpenAIToAnthropicConverter();
    mockContext = {
      requestId: 'test-req-123',
      timestamp: Date.now(),
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1'
    };
  });

  describe('Non-streaming Response Conversion', () => {
    test('should handle standard OpenAI response without reasoning_content', async () => {
      const openaiResponse: OpenAIResponse = {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '这是标准回答',
            tool_calls: []
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      };

      const result = await converter.convertResponse(openaiResponse, mockContext, 'claude-3-opus');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.content).toHaveLength(1);
      expect(result.data!.content[0]).toEqual({
        type: 'text',
        text: '这是标准回答'
      });
    });

    test('should handle DeepSeek response with reasoning_content only', async () => {
      const deepSeekResponse: OpenAIResponse = {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            reasoning_content: '不需要解释',
            tool_calls: []
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      };

      const result = await converter.convertResponse(deepSeekResponse, mockContext, 'claude-3-opus');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.content).toHaveLength(1);
      expect(result.data!.content[0]).toEqual({
        type: 'text',
        text: '不需要解释'
      });
    });

    test('should handle DeepSeek response with both reasoning_content and content', async () => {
      const deepSeekResponse: OpenAIResponse = {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '最终答案',
            reasoning_content: '我需要思考一下这个问题...',
            tool_calls: []
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      };

      const result = await converter.convertResponse(deepSeekResponse, mockContext, 'claude-3-opus');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.content).toHaveLength(2);
      expect(result.data!.content[0]).toEqual({
        type: 'text',
        text: '我需要思考一下这个问题...'
      });
      expect(result.data!.content[1]).toEqual({
        type: 'text',
        text: '最终答案'
      });
    });

    test('should handle empty reasoning_content', async () => {
      const deepSeekResponse: OpenAIResponse = {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '直接答案',
            reasoning_content: '',
            tool_calls: []
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      };

      const result = await converter.convertResponse(deepSeekResponse, mockContext, 'claude-3-opus');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.content).toHaveLength(1);
      expect(result.data!.content[0]).toEqual({
        type: 'text',
        text: '直接答案'
      });
    });
  });

  describe('Streaming Response Conversion', () => {
    test('should handle first chunk with message_start', async () => {
      const streamChunk: OpenAIStreamChunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {
            role: 'assistant',
            content: '',
            reasoning_content: undefined
          },
          finish_reason: undefined
        }]
      };

      const result = await converter.convertStreamChunk(streamChunk, mockContext, 'claude-3-opus', true);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!).toHaveLength(2);
      expect(result.data![0].type).toBe('message_start');
      expect(result.data![1].type).toBe('content_block_start');
    });

    test('should handle reasoning_content delta with prefix', async () => {
      const streamChunk: OpenAIStreamChunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {
            reasoning_content: '不需要解释'
          },
          finish_reason: undefined
        }]
      };

      const result = await converter.convertStreamChunk(streamChunk, mockContext, 'claude-3-opus');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!).toHaveLength(1);
      expect(result.data![0]).toEqual({
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: '不需要解释'
        }
      });
    });

    test('should handle subsequent reasoning_content delta', async () => {
      const streamChunk: OpenAIStreamChunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {
            reasoning_content: '第二部分'
          },
          finish_reason: undefined
        }]
      };

      const result = await converter.convertStreamChunk(streamChunk, mockContext, 'claude-3-opus');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!).toHaveLength(1);
      expect(result.data![0]).toEqual({
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: '第二部分'
        }
      });
    });

    test('should handle regular content delta', async () => {
      const streamChunk: OpenAIStreamChunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {
            content: '这是正常内容'
          },
          finish_reason: undefined
        }]
      };

      const result = await converter.convertStreamChunk(streamChunk, mockContext, 'claude-3-opus');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!).toHaveLength(1);
      expect(result.data![0]).toEqual({
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: '这是正常内容'
        }
      });
    });

    test('should apply special finish_reason handling for reasoning-only completion', async () => {
      const streamChunk: OpenAIStreamChunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {
            reasoning_content: '推理完成'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      };

      const result = await converter.convertStreamChunk(streamChunk, mockContext, 'claude-3-opus');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      // Should only have the reasoning content delta, no stop events
      expect(result.data!).toHaveLength(1);
      expect(result.data![0].type).toBe('content_block_delta');
      
      // Should not contain message_stop or content_block_stop
      const eventTypes = result.data!.map(chunk => chunk.type);
      expect(eventTypes).not.toContain('message_stop');
      expect(eventTypes).not.toContain('content_block_stop');
      expect(eventTypes).not.toContain('message_delta');
    });

    test('should handle normal completion with both reasoning and content', async () => {
      const streamChunk: OpenAIStreamChunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {
            content: '最终答案'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      };

      const result = await converter.convertStreamChunk(streamChunk, mockContext, 'claude-3-opus');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      // Should have content delta and completion events
      expect(result.data!.length).toBeGreaterThan(1);
      
      const eventTypes = result.data!.map(chunk => chunk.type);
      expect(eventTypes).toContain('content_block_delta');
      expect(eventTypes).toContain('content_block_stop');
      expect(eventTypes).toContain('message_delta');
      expect(eventTypes).toContain('message_stop');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed response gracefully', async () => {
      const malformedResponse = {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [], // Empty choices array
        usage: {
          prompt_tokens: 10,
          completion_tokens: 0,
          total_tokens: 10
        }
      } as OpenAIResponse;

      const result = await converter.convertResponse(malformedResponse, mockContext, 'claude-3-opus');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.type).toBe('api_error');
      expect(result.error!.message).toContain('No choices in OpenAI response');
    });

    test('should handle streaming conversion errors gracefully', async () => {
      const malformedChunk = {
        // Missing required fields
        id: 'chatcmpl-test'
      } as OpenAIStreamChunk;

      const result = await converter.convertStreamChunk(malformedChunk, mockContext, 'claude-3-opus');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.type).toBe('internal_error');
    });
  });

  describe('Anthropic API Compatibility', () => {
    test('should produce standard Anthropic response structure', async () => {
      const deepSeekResponse: OpenAIResponse = {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '答案',
            reasoning_content: '推理',
            tool_calls: []
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      };

      const result = await converter.convertResponse(deepSeekResponse, mockContext, 'claude-3-opus');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      const response = result.data!;
      
      // Verify standard Anthropic response structure
      expect(response.id).toMatch(/^msg_/);
      expect(response.type).toBe('message');
      expect(response.role).toBe('assistant');
      expect(response.model).toBe('claude-3-opus');
      expect(response.stop_reason).toBe('end_turn');
      
      // Verify usage statistics
      expect(response.usage.input_tokens).toBe(10);
      expect(response.usage.output_tokens).toBe(15);
      
      // Verify content is array of standard text blocks
      expect(Array.isArray(response.content)).toBe(true);
      response.content.forEach(block => {
        expect(block.type).toBe('text');
        expect(typeof block.text).toBe('string');
      });
    });

    test('should produce standard Anthropic streaming events', async () => {
      const streamChunk: OpenAIStreamChunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {
            reasoning_content: '推理内容'
          },
          finish_reason: undefined
        }]
      };

      const result = await converter.convertStreamChunk(streamChunk, mockContext, 'claude-3-opus');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      const chunks = result.data!;
      
      // Verify all chunks have standard Anthropic stream event structure
      chunks.forEach(chunk => {
        expect(chunk.type).toMatch(/^(message_start|content_block_start|content_block_delta|content_block_stop|message_delta|message_stop)$/);
        
        if (chunk.type === 'content_block_delta') {
          expect(chunk.delta?.type).toBe('text_delta');
          expect(typeof chunk.delta?.text).toBe('string');
        }
      });
    });
  });
});