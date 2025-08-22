/**
 * Anthropic to OpenAI Converter Tests
 */

import { AnthropicToOpenAIConverter } from '@/converters/anthropic-to-openai.js';
import type { AnthropicRequest, ModelMapping, ConversionContext } from '@/types/index.js';

describe('AnthropicToOpenAIConverter', () => {
  let converter: AnthropicToOpenAIConverter;
  let modelMapping: ModelMapping;
  let context: ConversionContext;

  beforeEach(() => {
    modelMapping = {
      'claude-3-opus-20240229': {
        openaiModel: 'gpt-4-turbo-preview',
        contextLength: 128000,
        maxTokens: 4096,
        capabilities: ['text', 'images', 'tools']
      },
      'claude-3-sonnet-20240229': {
        openaiModel: 'gpt-4',
        contextLength: 8192,
        maxTokens: 4096,
        capabilities: ['text', 'images']
      }
    };

    converter = new AnthropicToOpenAIConverter(modelMapping);
    
    context = {
      requestId: 'test-request-123',
      timestamp: Date.now(),
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1'
    };
  });

  describe('convertRequest', () => {
    it('should convert basic Anthropic request to OpenAI format', async () => {
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

      const result = await converter.convertRequest(anthropicRequest, context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.model).toBe('gpt-4-turbo-preview');
      expect(result.data?.max_tokens).toBe(100);
      expect(result.data?.messages).toHaveLength(1);
      expect(result.data?.messages[0].role).toBe('user');
      expect(result.data?.messages[0].content).toBe('Hello, how are you?');
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

    it('should convert tools correctly', async () => {
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

      const result = await converter.convertRequest(anthropicRequest, context);

      expect(result.success).toBe(true);
      expect(result.data?.tools).toHaveLength(1);
      expect(result.data?.tools?.[0].type).toBe('function');
      expect(result.data?.tools?.[0].function.name).toBe('get_weather');
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