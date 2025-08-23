/**
 * Anthropic to OpenAI Converter Tests
 */

import { AnthropicToOpenAIConverter } from '@/converters/anthropic-to-openai.js';
import type { AnthropicRequest } from '@/types/index.js';

describe('AnthropicToOpenAIConverter', () => {
  let converter: AnthropicToOpenAIConverter;

  beforeEach(() => {
    converter = new AnthropicToOpenAIConverter();
  });

  describe('convertRequest', () => {
    it('should convert basic Anthropic request to OpenAI format', () => {
      const anthropicRequest: AnthropicRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: 'Hello, how are you?'
          }
        ]
      };

      const result = converter.convertRequest(anthropicRequest, 'test-request-123');

      expect(result.model).toBeDefined();
      expect(result.max_tokens).toBe(100);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe('Hello, how are you?');
    });

    it('should convert system message to first message in OpenAI format', async () => {
      const anthropicRequest: AnthropicRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        system: 'You are a helpful assistant.',
        messages: [
          {
            role: 'user',
            content: 'Hello!'
          }
        ]
      };

      const result = await converter.convertRequest(anthropicRequest, context);

      expect(result.success).toBe(true);
      expect(result.data?.messages).toHaveLength(2);
      expect(result.data?.messages[0].role).toBe('system');
      expect(result.data?.messages[0].content).toBe('You are a helpful assistant.');
      expect(result.data?.messages[1].role).toBe('user');
    });

    it('should handle complex content arrays', async () => {
      const anthropicRequest: AnthropicRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Look at this image:' },
              { 
                type: 'image', 
                source: { 
                  type: 'base64', 
                  media_type: 'image/jpeg', 
                  data: 'base64data' 
                } 
              }
            ]
          }
        ]
      };

      const result = await converter.convertRequest(anthropicRequest, context);

      expect(result.success).toBe(true);
      expect(result.data?.messages[0].content).toContain('Look at this image:');
      expect(result.data?.messages[0].content).toContain('[Image content provided');
    });

    it('should reject unsupported audio content', async () => {
      const anthropicRequest: AnthropicRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Listen to this:' },
              { 
                type: 'input_audio' as any,
                source: { 
                  type: 'base64', 
                  media_type: 'audio/wav', 
                  data: 'audiodata' 
                } 
              }
            ]
          }
        ]
      };

      const result = await converter.convertRequest(anthropicRequest, context);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('not_supported_error');
      expect(result.error?.message).toContain('音频输入功能暂不支持');
    });

    it('should reject unsupported file content', async () => {
      const anthropicRequest: AnthropicRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Read this file:' },
              { 
                type: 'file' as any,
                source: { 
                  type: 'base64', 
                  media_type: 'application/pdf', 
                  data: 'filedata' 
                } 
              }
            ]
          }
        ]
      };

      const result = await converter.convertRequest(anthropicRequest, context);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('not_supported_error');
      expect(result.error?.message).toContain('文件上传功能暂不支持');
    });

    it('should validate required parameters', async () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        // Missing max_tokens
        messages: [
          {
            role: 'user',
            content: 'Hello!'
          }
        ]
      } as AnthropicRequest;

      const result = await converter.convertRequest(anthropicRequest, context);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('invalid_request_error');
      expect(result.error?.message).toContain('max_tokens');
    });

    it('should handle unsupported model', async () => {
      const anthropicRequest: AnthropicRequest = {
        model: 'unsupported-model',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: 'Hello!'
          }
        ]
      };

      const result = await converter.convertRequest(anthropicRequest, context);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('invalid_request_error');
      expect(result.error?.message).toContain('Unsupported model');
    });

    it('should convert tools correctly', () => {
      const anthropicRequest: AnthropicRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: 'What\'s the weather?'
          }
        ],
        tools: [
          {
            name: 'get_weather',
            description: 'Get current weather',
            input_schema: {
              type: 'object',
              properties: {
                location: { type: 'string' }
              },
              required: ['location']
            }
          }
        ]
      };

      const result = converter.convertRequest(anthropicRequest, 'test-request-123');

      expect(result.tools).toHaveLength(1);
      expect(result.tools?.[0].type).toBe('function');
      expect(result.tools?.[0].function.name).toBe('get_weather');
    });

    // Tool Choice 自动设置功能测试
    describe('tool_choice auto-setting', () => {
      it('should auto-set tool_choice to auto when tools provided but tool_choice not set', () => {
        const anthropicRequest: AnthropicRequest = {
          model: 'claude-3-opus-20240229',
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: 'What\'s the weather?'
            }
          ],
          tools: [
            {
              name: 'get_weather',
              description: 'Get current weather',
              input_schema: {
                type: 'object',
                properties: {
                  location: { type: 'string' }
                },
                required: ['location']
              }
            }
          ]
          // tool_choice 未设置
        };

        const result = converter.convertRequest(anthropicRequest, 'test-request-123');

        expect(result.tool_choice).toBe('auto');
        expect(result.tools).toHaveLength(1);
      });

      it('should keep user-specified tool_choice when provided', () => {
        const anthropicRequest: AnthropicRequest = {
          model: 'claude-3-opus-20240229',
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: 'What\'s the weather?'
            }
          ],
          tools: [
            {
              name: 'get_weather',
              description: 'Get current weather',
              input_schema: {
                type: 'object',
                properties: {
                  location: { type: 'string' }
                },
                required: ['location']
              }
            }
          ],
          tool_choice: {
            type: 'tool',
            name: 'get_weather'
          }
        };

        const result = converter.convertRequest(anthropicRequest, 'test-request-123');

        expect(result.tool_choice).toEqual({
          type: 'function',
          function: { name: 'get_weather' }
        });
      });

      it('should not set tool_choice when no tools provided', () => {
        const anthropicRequest: AnthropicRequest = {
          model: 'claude-3-opus-20240229',
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: 'Hello!'
            }
          ]
          // 没有 tools
        };

        const result = converter.convertRequest(anthropicRequest, 'test-request-123');

        expect(result.tool_choice).toBeUndefined();
      });

      it('should not set tool_choice when tools array is empty', () => {
        const anthropicRequest: AnthropicRequest = {
          model: 'claude-3-opus-20240229',
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: 'Hello!'
            }
          ],
          tools: [] // 空数组
        };

        const result = converter.convertRequest(anthropicRequest, 'test-request-123');

        expect(result.tool_choice).toBeUndefined();
      });

      it('should not set tool_choice when tools are invalid', () => {
        const anthropicRequest: AnthropicRequest = {
          model: 'claude-3-opus-20240229',
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: 'Hello!'
            }
          ],
          tools: [
            {
              name: '', // 无效的工具名
              description: 'Invalid tool',
              input_schema: {
                type: 'object',
                properties: {},
                required: []
              }
            }
          ]
        };

        const result = converter.convertRequest(anthropicRequest, 'test-request-123');

        expect(result.tool_choice).toBeUndefined();
      });

      it('should handle multiple valid tools and auto-set tool_choice', () => {
        const anthropicRequest: AnthropicRequest = {
          model: 'claude-3-opus-20240229',
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: 'What can you help me with?'
            }
          ],
          tools: [
            {
              name: 'get_weather',
              description: 'Get current weather',
              input_schema: {
                type: 'object',
                properties: {
                  location: { type: 'string' }
                },
                required: ['location']
              }
            },
            {
              name: 'calculate',
              description: 'Perform calculations',
              input_schema: {
                type: 'object',
                properties: {
                  expression: { type: 'string' }
                },
                required: ['expression']
              }
            }
          ]
        };

        const result = converter.convertRequest(anthropicRequest, 'test-request-123');

        expect(result.tools).toHaveLength(2);
        expect(result.tool_choice).toBe('auto');
      });

      it('should handle mixed valid and invalid tools correctly', () => {
        const anthropicRequest: AnthropicRequest = {
          model: 'claude-3-opus-20240229',
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: 'Help me with this'
            }
          ],
          tools: [
            {
              name: 'valid_tool',
              description: 'A valid tool',
              input_schema: {
                type: 'object',
                properties: {
                  param: { type: 'string' }
                },
                required: ['param']
              }
            },
            {
              name: '', // 无效工具
              description: 'Invalid tool',
              input_schema: {}
            } as any
          ]
        };

        const result = converter.convertRequest(anthropicRequest, 'test-request-123');

        // 应该自动设置 tool_choice，因为有至少一个有效工具
        expect(result.tool_choice).toBe('auto');
        expect(result.tools).toHaveLength(2); // 转换器仍然处理所有工具
      });
    });

    it('should add metadata to system prompt', async () => {
      const anthropicRequest: AnthropicRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        system: 'You are helpful.',
        messages: [
          {
            role: 'user',
            content: 'Hello!'
          }
        ],
        metadata: {
          user_id: 'user123',
          session_id: 'session456'
        },
        anthropic_version: 'bedrock-2023-05-31'
      };

      const result = await converter.convertRequest(anthropicRequest, context);

      expect(result.success).toBe(true);
      expect(result.data?.messages[0].content).toContain('You are helpful.');
      expect(result.data?.messages[0].content).toContain('CONTEXT_INFO');
      expect(result.data?.messages[0].content).toContain('user123');
      expect(result.data?.messages[0].content).toContain('API_VERSION');
    });
  });
});