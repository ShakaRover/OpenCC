/**
 * Verification test for DeepSeek reasoning_content support in actual converter
 * Including special tag processing functionality
 */

import { openaiToAnthropicResponseConverter } from '../../src/converters/openai-to-anthropic';

describe('DeepSeek Reasoning Content Support - Actual Converter', () => {
  const mockRequestId = 'test-request-123';

  describe('Non-streaming Response', () => {
    test('should handle response with reasoning_content only', () => {
      const openaiResponse = {
        id: 'chatcmpl-test',
        object: 'chat.completion' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: null,
            reasoning_content: '准确的当前日期'
          },
          finish_reason: 'stop' as const
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      };

      const result = openaiToAnthropicResponseConverter.convertResponse(
        openaiResponse,
        'claude-3-opus',
        mockRequestId
      );

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: 'text',
        text: '准确的当前日期'
      });
    });

    test('should handle response with special tags in reasoning_content', () => {
      const openaiResponse = {
        id: 'chatcmpl-test',
        object: 'chat.completion' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: null,
            reasoning_content: '<think>我需要分析这个问题</think>现在开始处理<｜tool▁calls▁begin｜>调用工具<｜tool▁calls▁end｜>完成'
          },
          finish_reason: 'stop' as const
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      };

      const result = openaiToAnthropicResponseConverter.convertResponse(
        openaiResponse,
        'claude-3-opus',
        mockRequestId
      );

      // 应该有多个内容块：思考 + 工具调用 + 原始内容
      expect(result.content.length).toBeGreaterThan(1);
      
      // 验证内容包含处理后的各部分
      const allText = result.content.map(c => c.text).join(' ');
      expect(allText).toContain('我需要分析这个问题');
      expect(allText).toContain('调用工具');
      expect(allText).toContain('现在开始处理');
      expect(allText).toContain('完成');
    });

    test('should handle response with both reasoning_content and content', () => {
      const openaiResponse = {
        id: 'chatcmpl-test',
        object: 'chat.completion' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: '最终答案',
            reasoning_content: '我需要思考这个问题...'
          },
          finish_reason: 'stop' as const
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      };

      const result = openaiToAnthropicResponseConverter.convertResponse(
        openaiResponse,
        'claude-3-opus',
        mockRequestId
      );

      expect(result.content).toHaveLength(2);
      expect(result.content[0]).toEqual({
        type: 'text',
        text: '我需要思考这个问题...'
      });
      expect(result.content[1]).toEqual({
        type: 'text',
        text: '最终答案'
      });
    });
  });

  describe('Streaming Response', () => {
    test('should handle reasoning_content delta with special tags', () => {
      const streamChunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {
            reasoning_content: '<think>分析问题</think>正常内容'
          },
          finish_reason: null
        }]
      };

      const result = openaiToAnthropicResponseConverter.convertStreamChunk(
        streamChunk,
        'claude-3-opus',
        mockRequestId,
        false
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('content_block_delta');
      // 应该包含清理后的内容（移除标签）
      expect(result[0]).toContain('分析问题');
      expect(result[0]).toContain('正常内容');
    });
      const streamChunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {
            reasoning_content: '准确的当前日期'
          },
          finish_reason: null
        }]
      };

      const result = openaiToAnthropicResponseConverter.convertStreamChunk(
        streamChunk,
        'claude-3-opus',
        mockRequestId,
        false
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('content_block_delta');
      expect(result[0]).toContain('准确的当前日期');
    });

    test('should handle reasoning_content delta without duplicate prefix', () => {
      const streamChunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {
            reasoning_content: '更多推理内容'
          },
          finish_reason: null
        }]
      };

      const result = openaiToAnthropicResponseConverter.convertStreamChunk(
        streamChunk,
        'claude-3-opus',
        mockRequestId,
        false
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('content_block_delta');
      expect(result[0]).toContain('更多推理内容');
      expect(result[0]).not.toContain('[推理过程]');
    });

    test('should apply special finish_reason handling for reasoning-only completion', () => {
      const streamChunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {
            reasoning_content: '推理完成'
          },
          finish_reason: 'stop' as const
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      };

      const result = openaiToAnthropicResponseConverter.convertStreamChunk(
        streamChunk,
        'claude-3-opus',
        mockRequestId,
        false
      );

      // Should only have the reasoning content delta, no stop events
      expect(result.length).toBeGreaterThan(0);
      const eventTypes = result.map(chunk => {
        const match = chunk.match(/"type":\s*"([^"]+)"/);
        return match ? match[1] : '';
      });
      
      expect(eventTypes).toContain('content_block_delta');
      // Should not contain stop events due to special handling
      expect(eventTypes).not.toContain('message_stop');
      expect(eventTypes).not.toContain('content_block_stop');
      expect(eventTypes).not.toContain('message_delta');
    });

    test('should handle normal completion with both reasoning and content', () => {
      const streamChunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {
            content: '最终答案'
          },
          finish_reason: 'stop' as const
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      };

      const result = openaiToAnthropicResponseConverter.convertStreamChunk(
        streamChunk,
        'claude-3-opus',
        mockRequestId,
        false
      );

      const eventTypes = result.map(chunk => {
        const match = chunk.match(/"type":\s*"([^"]+)"/);
        return match ? match[1] : '';
      });
      
      expect(eventTypes).toContain('content_block_delta');
      expect(eventTypes).toContain('content_block_stop');
      expect(eventTypes).toContain('message_delta');
      expect(eventTypes).toContain('message_stop');
    });
  });
});