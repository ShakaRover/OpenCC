/**
 * Unit tests for enhanced StreamingTagParser class
 * Tests cross-chunk tag state management and special tag processing
 */

import { StreamingTagParser, DEEPSEEK_TAGS } from '../../src/converters/deepseek-tag-parser';

describe('Enhanced StreamingTagParser', () => {
  let parser: StreamingTagParser;

  beforeEach(() => {
    parser = new StreamingTagParser();
  });

  describe('Basic Tag Processing', () => {
    test('should process simple content without tags', () => {
      const result = parser.processChunk('普通文本内容');
      
      expect(result.cleanedContent).toBe('普通文本内容');
      expect(result.isTagStart).toBe(false);
      expect(result.isTagEnd).toBe(false);
      expect(result.hasPartialTag).toBe(false);
    });

    test('should detect thinking tags', () => {
      const result = parser.processChunk('<think>思考内容</think>');
      
      expect(result.isTagStart).toBe(true);
      expect(result.isTagEnd).toBe(true);
      expect(result.tagType).toBe('thinking');
      expect(result.extractedContent?.thoughts).toContain('思考内容');
    });

    test('should detect tool call tags', () => {
      const result = parser.processChunk('<｜tool▁calls▁begin｜>工具调用<｜tool▁calls▁end｜>');
      
      expect(result.isTagStart).toBe(true);
      expect(result.isTagEnd).toBe(true);
      expect(result.tagType).toBe('tool_reasoning');
      expect(result.extractedContent?.rawContent).toContain('工具调用');
    });
  });

  describe('Cross-Chunk Tag Processing', () => {
    test('should handle partial tag at end of chunk', () => {
      // 第一个块：部分标签
      const result1 = parser.processChunk('内容<thi');
      
      expect(result1.hasPartialTag).toBe(true);
      expect(result1.cleanedContent).toBe(''); // 暂时不输出
      
      // 第二个块：完成标签
      const result2 = parser.processChunk('nk>思考</think>');
      
      expect(result2.isTagStart).toBe(true);
      expect(result2.isTagEnd).toBe(true);
      expect(result2.tagType).toBe('thinking');
      expect(result2.extractedContent?.thoughts).toContain('思考');
    });

    test('should handle tag spanning multiple chunks', () => {
      // 开始标签
      const result1 = parser.processChunk('<think>');
      expect(result1.isTagStart).toBe(true);
      expect(result1.tagType).toBe('thinking');
      
      // 中间内容
      const result2 = parser.processChunk('这是思考的');
      expect(result2.isTagStart).toBe(false);
      expect(result2.isTagEnd).toBe(false);
      expect(result2.cleanedContent).toBe(''); // 标签内容不立即输出
      
      // 更多内容
      const result3 = parser.processChunk('内容部分');
      expect(result3.cleanedContent).toBe(''); // 仍在标签内
      
      // 结束标签
      const result4 = parser.processChunk('</think>输出内容');
      expect(result4.isTagEnd).toBe(true);
      expect(result4.extractedContent?.thoughts).toContain('这是思考的内容部分');
      expect(result4.cleanedContent).toContain('这是思考的内容部分');
    });

    test('should handle nested tags', () => {
      const result = parser.processChunk('<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>内层工具<｜tool▁call▁end｜><｜tool▁calls▁end｜>');
      
      expect(result.isTagStart).toBe(true);
      expect(result.isTagEnd).toBe(true);
      expect(result.tagType).toBe('tool_reasoning');
      expect(result.extractedContent?.rawContent.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Tag Sequences', () => {
    test('should handle mixed content with multiple tag types', () => {
      // 第一部分：思考标签
      let result = parser.processChunk('开始<think>分析问题');
      expect(result.isTagStart).toBe(true);
      expect(result.tagType).toBe('thinking');
      
      // 完成思考标签
      result = parser.processChunk('</think>中间内容<｜tool▁calls▁begin｜>');
      expect(result.isTagEnd).toBe(true); // 思考结束
      expect(result.isTagStart).toBe(true); // 工具调用开始
      
      // 完成工具调用
      result = parser.processChunk('工具内容<｜tool▁calls▁end｜>结尾');
      expect(result.isTagEnd).toBe(true);
      expect(result.cleanedContent).toContain('结尾');
    });

    test('should handle incomplete tag sequences gracefully', () => {
      // 只有开始标签，没有结束标签
      const result1 = parser.processChunk('<think>未完成的思考');
      expect(result1.isTagStart).toBe(true);
      
      // 强制完成处理
      const finalResult = parser.finalize();
      expect(finalResult.extractedContent?.thoughts).toContain('未完成的思考');
      expect(finalResult.cleanedContent).toContain('未完成的思考');
    });

    test('should handle tool calls with JSON parsing', () => {
      const toolJson = '{"name": "search_web", "arguments": "{\\"query\\": \\"test\\"}"}';
      const result = parser.processChunk(`<｜tool▁calls▁begin｜>${toolJson}<｜tool▁calls▁end｜>`);
      
      expect(result.extractedContent?.toolCalls.length).toBeGreaterThan(0);
      const toolCall = result.extractedContent?.toolCalls[0];
      expect(toolCall?.name).toBe('search_web');
    });

    test('should handle tool calls with separator format', () => {
      const result = parser.processChunk('<｜tool▁calls▁begin｜>search_web<｜tool▁sep｜>{"query": "test"}<｜tool▁calls▁end｜>');
      
      expect(result.extractedContent?.toolCalls.length).toBeGreaterThan(0);
      const toolCall = result.extractedContent?.toolCalls[0];
      expect(toolCall?.name).toBe('search_web');
      expect(toolCall?.arguments).toBe('{"query": "test"}');
    });
  });

  describe('Buffer Management', () => {
    test('should maintain reasonable buffer size', () => {
      // 添加大量内容
      for (let i = 0; i < 100; i++) {
        parser.processChunk(`内容块${i} `);
      }
      
      const state = parser.getState();
      // 缓冲区不应该无限增长
      expect(state.buffer.length).toBeLessThan(1000);
    });

    test('should preserve partial tag matches across buffer cleanup', () => {
      // 添加大量内容，然后是部分标签
      for (let i = 0; i < 50; i++) {
        parser.processChunk(`内容块${i} `);
      }
      
      const result = parser.processChunk('<thi');
      expect(result.hasPartialTag).toBe(true);
      
      // 完成标签应该仍然工作
      const result2 = parser.processChunk('nk>思考</think>');
      expect(result2.isTagEnd).toBe(true);
    });
  });

  describe('State Management', () => {
    test('should allow state reset', () => {
      parser.processChunk('<think>一些内容');
      let state = parser.getState();
      expect(state.isInTag).toBe(true);
      
      parser.reset();
      state = parser.getState();
      expect(state.isInTag).toBe(false);
      expect(state.buffer).toBe('');
      expect(state.tagStack).toHaveLength(0);
    });

    test('should provide read-only state access', () => {
      parser.processChunk('<think>内容');
      const state = parser.getState();
      
      // 尝试修改状态不应影响内部状态
      (state as any).buffer = '修改后的缓冲区';
      
      const newState = parser.getState();
      expect(newState.buffer).not.toBe('修改后的缓冲区');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON in tool calls gracefully', () => {
      const result = parser.processChunk('<｜tool▁calls▁begin｜>{"invalid": json}<｜tool▁calls▁end｜>');
      
      expect(result.extractedContent?.rawContent.length).toBeGreaterThan(0);
      // 应该作为原始内容而不是工具调用处理
    });

    test('should handle empty chunks', () => {
      const result = parser.processChunk('');
      
      expect(result.cleanedContent).toBe('');
      expect(result.isTagStart).toBe(false);
      expect(result.isTagEnd).toBe(false);
      expect(result.hasPartialTag).toBe(false);
    });

    test('should handle special characters in content', () => {
      const specialContent = '特殊字符：！@#￥%……&*（）——+{}[]|\\:";\'<>?,./`~';
      const result = parser.processChunk(specialContent);
      
      expect(result.cleanedContent).toBe(specialContent);
    });
  });

  describe('Performance', () => {
    test('should handle large content efficiently', () => {
      const largeContent = 'x'.repeat(10000);
      const start = performance.now();
      
      const result = parser.processChunk(largeContent);
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // 应该在100ms内完成
      expect(result.cleanedContent).toBe(largeContent);
    });

    test('should handle many small chunks efficiently', () => {
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        parser.processChunk('小块内容 ');
      }
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(200); // 应该在200ms内完成
    });
  });
});