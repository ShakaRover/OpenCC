/**
 * Tool Choice Auto-Set Feature Tests
 * 测试 tool_choice 自动设置功能
 */

import { AnthropicToOpenAIConverter } from '../../src/converters/anthropic-to-openai';
import type { AnthropicRequest } from '../../src/types/anthropic';

describe('AnthropicToOpenAIConverter - Tool Choice Auto-Set', () => {
  let converter: AnthropicToOpenAIConverter;

  beforeEach(() => {
    converter = new AnthropicToOpenAIConverter();
  });

  describe('tool_choice auto-setting functionality', () => {
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

      const result = converter.convertRequest(anthropicRequest, 'test-request-001');

      expect(result.tool_choice).toBe('auto');
      expect(result.tools).toHaveLength(1);
      expect(result.tools?.[0].function.name).toBe('get_weather');
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

      const result = converter.convertRequest(anthropicRequest, 'test-request-002');

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

      const result = converter.convertRequest(anthropicRequest, 'test-request-003');

      expect(result.tool_choice).toBeUndefined();
      expect(result.tools).toBeUndefined();
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

      const result = converter.convertRequest(anthropicRequest, 'test-request-004');

      expect(result.tool_choice).toBeUndefined();
      expect(result.tools).toBeUndefined();
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

      const result = converter.convertRequest(anthropicRequest, 'test-request-005');

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

      const result = converter.convertRequest(anthropicRequest, 'test-request-006');

      expect(result.tools).toHaveLength(2);
      expect(result.tool_choice).toBe('auto');
      expect(result.tools?.[0].function.name).toBe('get_weather');
      expect(result.tools?.[1].function.name).toBe('calculate');
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

      const result = converter.convertRequest(anthropicRequest, 'test-request-007');

      // 应该自动设置 tool_choice，因为有至少一个有效工具
      expect(result.tool_choice).toBe('auto');
      expect(result.tools).toHaveLength(2); // 转换器仍然处理所有工具
    });

    it('should handle tools without valid input_schema', () => {
      const anthropicRequest: AnthropicRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: 'Help me'
          }
        ],
        tools: [
          {
            name: 'test_tool',
            description: 'A test tool',
            input_schema: null as any // 无效的 schema
          }
        ]
      };

      const result = converter.convertRequest(anthropicRequest, 'test-request-008');

      expect(result.tool_choice).toBeUndefined();
    });

    it('should preserve existing tool_choice of type auto', () => {
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
          type: 'auto'
        }
      };

      const result = converter.convertRequest(anthropicRequest, 'test-request-009');

      expect(result.tool_choice).toBe('auto');
    });

    it('should preserve existing tool_choice of type any', () => {
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
          type: 'any'
        }
      };

      const result = converter.convertRequest(anthropicRequest, 'test-request-010');

      // OpenAI doesn't have 'any', so it converts to 'auto'
      expect(result.tool_choice).toBe('auto');
    });
  });

  describe('tool validation', () => {
    it('should validate tool name is non-empty string', () => {
      const requests = [
        {
          name: '',
          description: 'Empty name',
          input_schema: { type: 'object', properties: {} }
        },
        {
          name: '   ',
          description: 'Whitespace name',
          input_schema: { type: 'object', properties: {} }
        },
        {
          name: null as any,
          description: 'Null name',
          input_schema: { type: 'object', properties: {} }
        }
      ];

      requests.forEach((tool, index) => {
        const anthropicRequest: AnthropicRequest = {
          model: 'claude-3-opus-20240229',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Test' }],
          tools: [tool as any]
        };

        const result = converter.convertRequest(anthropicRequest, `test-validation-${index}`);
        expect(result.tool_choice).toBeUndefined();
      });
    });

    it('should validate input_schema exists and is object', () => {
      const requests = [
        {
          name: 'test_tool',
          description: 'Test tool',
          input_schema: null
        },
        {
          name: 'test_tool',
          description: 'Test tool',
          input_schema: undefined
        },
        {
          name: 'test_tool',
          description: 'Test tool',
          input_schema: 'invalid'
        }
      ];

      requests.forEach((tool, index) => {
        const anthropicRequest: AnthropicRequest = {
          model: 'claude-3-opus-20240229',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Test' }],
          tools: [tool as any]
        };

        const result = converter.convertRequest(anthropicRequest, `test-schema-${index}`);
        expect(result.tool_choice).toBeUndefined();
      });
    });
  });
});