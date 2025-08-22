/**
 * OpenAI to Anthropic Response Converter Tests
 */

import { OpenAIToAnthropicConverter } from '@/converters/openai-to-anthropic.js';
import type { OpenAIResponse, OpenAIStreamChunk, ConversionContext } from '@/types/index.js';

describe('OpenAIToAnthropicConverter', () => {
  let converter: OpenAIToAnthropicConverter;
  let context: ConversionContext;

  beforeEach(() => {
    converter = new OpenAIToAnthropicConverter();
    
    context = {
      requestId: 'test-request-123',
      timestamp: Date.now(),
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1'
    };
  });

  describe('convertResponse', () => {
    it('should convert basic OpenAI response to Anthropic format', async () => {
      const openaiResponse: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4-turbo-preview',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 8,
          total_tokens: 18
        }
      };

      const result = await converter.convertResponse(
        openaiResponse,
        context,
        'claude-3-opus-20240229'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.type).toBe('message');
      expect(result.data?.role).toBe('assistant');
      expect(result.data?.model).toBe('claude-3-opus-20240229');
      expect(result.data?.content).toHaveLength(1);
      expect(result.data?.content[0].type).toBe('text');
      expect(result.data?.content[0].text).toBe('Hello! How can I help you today?');
      expect(result.data?.usage.input_tokens).toBe(10);
      expect(result.data?.usage.output_tokens).toBe(8);
      expect(result.data?.stop_reason).toBe('end_turn');
    });

    it('should convert tool calls correctly', async () => {
      const openaiResponse: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4-turbo-preview',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location": "San Francisco"}'
                  }
                }
              ]
            },
            finish_reason: 'tool_calls'
          }
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 15,
          total_tokens: 35
        }
      };

      const result = await converter.convertResponse(
        openaiResponse,
        context,
        'claude-3-opus-20240229'
      );

      expect(result.success).toBe(true);
      expect(result.data?.content).toHaveLength(1);
      expect(result.data?.content[0].type).toBe('tool_use');
      expect(result.data?.content[0].id).toBe('call_123');
      expect(result.data?.content[0].name).toBe('get_weather');
      expect(result.data?.content[0].input).toEqual({ location: 'San Francisco' });
      expect(result.data?.stop_reason).toBe('tool_use');
    });

    it('should handle mixed content and tool calls', async () => {
      const openaiResponse: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4-turbo-preview',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'I\'ll check the weather for you.',
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location": "New York"}'
                  }
                }
              ]
            },
            finish_reason: 'tool_calls'
          }
        ],
        usage: {
          prompt_tokens: 25,
          completion_tokens: 20,
          total_tokens: 45
        }
      };

      const result = await converter.convertResponse(
        openaiResponse,
        context,
        'claude-3-opus-20240229'
      );

      expect(result.success).toBe(true);
      expect(result.data?.content).toHaveLength(2);
      expect(result.data?.content[0].type).toBe('text');
      expect(result.data?.content[0].text).toBe('I\'ll check the weather for you.');
      expect(result.data?.content[1].type).toBe('tool_use');
      expect(result.data?.content[1].name).toBe('get_weather');
    });

    it('should map finish reasons correctly', async () => {
      const testCases = [
        { openaiReason: 'stop', anthropicReason: 'end_turn' },
        { openaiReason: 'length', anthropicReason: 'max_tokens' },
        { openaiReason: 'tool_calls', anthropicReason: 'tool_use' },
        { openaiReason: 'content_filter', anthropicReason: 'end_turn' }
      ];

      for (const testCase of testCases) {
        const openaiResponse: OpenAIResponse = {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-4-turbo-preview',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Test response'
              },
              finish_reason: testCase.openaiReason as any
            }
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15
          }
        };

        const result = await converter.convertResponse(
          openaiResponse,
          context,
          'claude-3-opus-20240229'
        );

        expect(result.success).toBe(true);
        expect(result.data?.stop_reason).toBe(testCase.anthropicReason);
      }
    });

    it('should handle empty response', async () => {
      const openaiResponse: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4-turbo-preview',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 0,
          total_tokens: 10
        }
      };

      const result = await converter.convertResponse(
        openaiResponse,
        context,
        'claude-3-opus-20240229'
      );

      expect(result.success).toBe(true);
      expect(result.data?.content).toHaveLength(1);
      expect(result.data?.content[0].type).toBe('text');
      expect(result.data?.content[0].text).toBe('');
    });

    it('should handle response with no choices', async () => {
      const openaiResponse: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4-turbo-preview',
        choices: [],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 0,
          total_tokens: 10
        }
      };

      const result = await converter.convertResponse(
        openaiResponse,
        context,
        'claude-3-opus-20240229'
      );

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('api_error');
      expect(result.error?.message).toContain('No choices');
    });
  });

  describe('convertStreamChunk', () => {
    it('should convert first streaming chunk correctly', async () => {
      const openaiChunk: OpenAIStreamChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1677652288,
        model: 'gpt-4-turbo-preview',
        choices: [
          {
            index: 0,
            delta: {
              role: 'assistant',
              content: 'Hello'
            }
          }
        ]
      };

      const result = await converter.convertStreamChunk(
        openaiChunk,
        context,
        'claude-3-opus-20240229',
        true // isFirst
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBeGreaterThan(1);
      
      // Check for message_start chunk
      const messageStart = result.data?.find(chunk => chunk.type === 'message_start');
      expect(messageStart).toBeDefined();
      expect(messageStart?.message?.type).toBe('message');
      
      // Check for content_block_start chunk
      const blockStart = result.data?.find(chunk => chunk.type === 'content_block_start');
      expect(blockStart).toBeDefined();
      
      // Check for content_block_delta chunk
      const blockDelta = result.data?.find(chunk => chunk.type === 'content_block_delta');
      expect(blockDelta).toBeDefined();
      expect(blockDelta?.delta?.text).toBe('Hello');
    });

    it('should convert streaming chunk with finish reason', async () => {
      const openaiChunk: OpenAIStreamChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1677652288,
        model: 'gpt-4-turbo-preview',
        choices: [
          {
            index: 0,
            delta: {
              content: ' there!'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      };

      const result = await converter.convertStreamChunk(
        openaiChunk,
        context,
        'claude-3-opus-20240229',
        false // not first
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      // Should include content delta, block stop, message delta, and message stop
      const blockDelta = result.data?.find(chunk => chunk.type === 'content_block_delta');
      expect(blockDelta?.delta?.text).toBe(' there!');
      
      const messageStop = result.data?.find(chunk => chunk.type === 'message_stop');
      expect(messageStop).toBeDefined();
      
      const messageDelta = result.data?.find(chunk => chunk.type === 'message_delta');
      expect(messageDelta?.delta?.stop_reason).toBe('end_turn');
    });
  });

  describe('createStreamData', () => {
    it('should format stream data correctly', () => {
      const chunk = {
        type: 'content_block_delta' as const,
        index: 0,
        delta: {
          type: 'text_delta' as const,
          text: 'Hello'
        }
      };

      const result = converter.createStreamData(chunk);
      
      expect(result).toBe(`data: ${JSON.stringify(chunk)}\n\n`);
    });
  });

  describe('createStreamEnd', () => {
    it('should create stream end marker', () => {
      const result = converter.createStreamEnd();
      expect(result).toBe('data: [DONE]\n\n');
    });
  });
});