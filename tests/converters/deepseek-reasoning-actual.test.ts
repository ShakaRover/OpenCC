/**
 * Verification test for DeepSeek reasoning_content support in actual converter
 * Including special tag processing functionality and content field support
 */

import { openaiToAnthropicResponseConverter, OpenAIToAnthropicResponseConverter } from '../../src/converters/openai-to-anthropic';

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
      
      // 验证思考内容
      const thoughtContent = result.content.find(c => c.type === 'text' && c.text?.includes('我需要分析这个问题'));
      expect(thoughtContent).toBeDefined();
      
      // 验证工具调用内容
      const toolContent = result.content.find(c => c.type === 'tool_use' && c.name === '调用工具');
      expect(toolContent).toBeDefined();
      
      // 验证原始内容
      const rawContent = result.content.filter(c => c.type === 'text').map(c => c.text).join(' ');
      expect(rawContent).toContain('现在开始处理');
      expect(rawContent).toContain('完成');
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

    // 新增：content 字段特殊标签支持测试
    test('should handle content field with special tags', () => {
      const openaiResponse = {
        id: 'chatcmpl-test',
        object: 'chat.completion' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: '<think>让我思考一下</think>这是最终答案<｜tool▁calls▁begin｜>search_web<｜tool▁sep｜>{"query": "test"}<｜tool▁calls▁end｜>搜索完成'
          },
          finish_reason: 'stop' as const
        }],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 25,
          total_tokens: 40
        }
      };

      const result = openaiToAnthropicResponseConverter.convertResponse(
        openaiResponse,
        'claude-3-opus',
        mockRequestId
      );

      // 应该有多个内容块：思考 + 原始内容 + 工具调用
      expect(result.content.length).toBeGreaterThan(1);
      
      // 验证思考内容存在
      const thoughtContent = result.content.find(c => c.type === 'text' && c.text?.includes('让我思考一下'));
      expect(thoughtContent).toBeDefined();
      
      // 验证工具调用存在
      const toolContent = result.content.find(c => c.type === 'tool_use' && c.name === 'search_web');
      expect(toolContent).toBeDefined();
      
      // 验证原始内容存在
      const rawContent = result.content.find(c => c.type === 'text' && c.text?.includes('这是最终答案'));
      expect(rawContent).toBeDefined();
    });

    test('should handle content field with only thinking tags', () => {
      const openaiResponse = {
        id: 'chatcmpl-test',
        object: 'chat.completion' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: '<think>纯思维过程，没有输出</think>'
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
        text: '纯思维过程，没有输出'
      });
    });

    test('should handle mixed reasoning_content and content with tags', () => {
      const openaiResponse = {
        id: 'chatcmpl-test',
        object: 'chat.completion' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: '<think>分析内容</think>这是内容字段',
            reasoning_content: '<think>分析推理</think>这是推理字段'
          },
          finish_reason: 'stop' as const
        }],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 30,
          total_tokens: 50
        }
      };

      const result = openaiToAnthropicResponseConverter.convertResponse(
        openaiResponse,
        'claude-3-opus',
        mockRequestId
      );

      // 应该包含来自两个字段的思考内容和普通内容
      expect(result.content.length).toBeGreaterThanOrEqual(4);
      
      const allText = result.content.map(c => c.text).join(' ');
      expect(allText).toContain('分析推理');
      expect(allText).toContain('这是推理字段');
      expect(allText).toContain('分析内容');
      expect(allText).toContain('这是内容字段');
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

    // 新增：content 字段流式特殊标签支持测试
    test('should handle content delta with special tags', () => {
      const streamChunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {
            content: '<think>思考中</think>输出内容'
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

      expect(result.length).toBeGreaterThan(0);
      const deltaEvents = result.filter(chunk => chunk.includes('content_block_delta'));
      expect(deltaEvents.length).toBeGreaterThan(0);
      
      // 验证包含处理后的内容
      const allContent = result.join(' ');
      expect(allContent).toContain('思考中');
      expect(allContent).toContain('输出内容');
    });

    test('should handle content delta with tool calls', () => {
      const streamChunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {
            content: '<｜tool▁calls▁begin｜>{"name": "search", "arguments": "{\\"query\\": \\"test\\"}"}<｜tool▁calls▁end｜>搜索完成'
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

      expect(result.length).toBeGreaterThan(0);
      const allContent = result.join(' ');
      expect(allContent).toContain('搜索完成');
    });

    test('should handle partial tag matching in content stream', () => {
      const converter = openaiToAnthropicResponseConverter as any;
      
      // 第一个块：部分标签
      const chunk1 = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {
            content: '<thi'
          },
          finish_reason: null
        }]
      };

      const result1 = converter.convertStreamChunk(chunk1, 'claude-3-opus', mockRequestId, false);
      
      // 第二个块：完成标签
      const chunk2 = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {
            content: 'nk>思考内容</think>'
          },
          finish_reason: null
        }]
      };

      const result2 = converter.convertStreamChunk(chunk2, 'claude-3-opus', mockRequestId, false);
      
      // 验证跨块标签解析
      const allResults = [...result1, ...result2];
      const allContent = allResults.join(' ');
      expect(allContent).toContain('思考内容');
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
    
    test('should handle more reasoning_content delta', () => {
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
      // 创建新的转换器实例来模拟完整的流
      const converter = new OpenAIToAnthropicResponseConverter();
      
      // First chunk: content with isFirst=true to reset state
      const contentChunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {
            reasoning_content: '推理完成'
          },
          finish_reason: null
        }]
      };

      const contentResult = converter.convertStreamChunk(
        contentChunk,
        'claude-3-opus',
        mockRequestId,
        true // isFirst=true 来重置状态
      );

      // Second chunk: finish signal (no delta, just finish_reason)
      const finishChunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop' as const
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      };

      const finishResult = converter.convertStreamChunk(
        finishChunk,
        'claude-3-opus',
        mockRequestId,
        false
      );

      // Content chunk should have start events and delta event
      expect(contentResult.length).toBeGreaterThan(0);
      const contentEventTypes = contentResult.map(chunk => {
        const match = chunk.match(/\"type\":\s*\"([^\"]+)\"/);
        return match ? match[1] : '';
      });
      expect(contentEventTypes).toContain('message_start');
      expect(contentEventTypes).toContain('content_block_start');
      expect(contentEventTypes).toContain('content_block_delta');

      // Finish chunk should have no stop events due to special handling
      const finishEventTypes = finishResult.map(chunk => {
        const match = chunk.match(/\"type\":\s*\"([^\"]+)\"/);
        return match ? match[1] : '';
      });
      expect(finishEventTypes).not.toContain('message_stop');
      expect(finishEventTypes).not.toContain('content_block_stop');
      expect(finishEventTypes).not.toContain('message_delta');
    });

    test('should handle normal completion with both reasoning and content', () => {
      // 创建新的转换器实例
      const converter = new OpenAIToAnthropicResponseConverter();
      
      // Content chunk
      const contentChunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {
            content: '最终答案'
          },
          finish_reason: null
        }]
      };

      const contentResult = converter.convertStreamChunk(
        contentChunk,
        'claude-3-opus',
        mockRequestId,
        true // isFirst=true
      );

      // Finish chunk
      const finishChunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk' as const,
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.1',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop' as const
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      };

      const finishResult = converter.convertStreamChunk(
        finishChunk,
        'claude-3-opus',
        mockRequestId,
        false
      );

      // Content chunk should have delta event
      const contentEventTypes = contentResult.map(chunk => {
        const match = chunk.match(/\"type\":\s*\"([^\"]+)\"/);
        return match ? match[1] : '';
      });
      expect(contentEventTypes).toContain('content_block_delta');

      // Finish chunk should have normal end events
      const finishEventTypes = finishResult.map(chunk => {
        const match = chunk.match(/\"type\":\s*\"([^\"]+)\"/);
        return match ? match[1] : '';
      });
      expect(finishEventTypes).toContain('content_block_stop');
      expect(finishEventTypes).toContain('message_delta');
      expect(finishEventTypes).toContain('message_stop');
    });
  });
});