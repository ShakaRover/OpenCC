/**
 * DeepSeek Tool Call Format Tests
 * 验证对 DeepSeek 工具调用格式的解析
 */

import { DeepSeekTagParser } from '../../src/converters/deepseek-tag-parser';

describe('DeepSeek Tool Call Format', () => {
  describe('parseReasoningContent with tool calls', () => {
    test('should parse single tool call with separator', () => {
      const content = `<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>get_weather<｜tool▁sep｜>{"location": "San Francisco"}<｜tool▁call▁end｜><｜tool▁calls▁end｜>`;
      const result = DeepSeekTagParser.parseReasoningContent(content);
      
      expect(result.hasSpecialTags).toBe(true);
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('get_weather');
      expect(result.toolCalls[0].arguments).toBe('{"location": "San Francisco"}');
    });

    test('should parse multiple tool calls with separator', () => {
      const content = `<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>get_weather<｜tool▁sep｜>{"location": "San Francisco"}<｜tool▁call▁end｜><｜tool▁call▁begin｜>search<｜tool▁sep｜>{"query": "weather forecast"}<｜tool▁call▁end｜><｜tool▁calls▁end｜>`;
      const result = DeepSeekTagParser.parseReasoningContent(content);
      
      expect(result.hasSpecialTags).toBe(true);
      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls[0].name).toBe('get_weather');
      expect(result.toolCalls[0].arguments).toBe('{"location": "San Francisco"}');
      expect(result.toolCalls[1].name).toBe('search');
      expect(result.toolCalls[1].arguments).toBe('{"query": "weather forecast"}');
    });

    test('should parse tool call with complex JSON arguments', () => {
      const content = `<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>search<｜tool▁sep｜>{"query": "latest news", "count": 5, "filters": {"date": "today"}}<｜tool▁call▁end｜><｜tool▁calls▁end｜>`;
      const result = DeepSeekTagParser.parseReasoningContent(content);
      
      expect(result.hasSpecialTags).toBe(true);
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('search');
      expect(result.toolCalls[0].arguments).toBe('{"query": "latest news", "count": 5, "filters": {"date": "today"}}');
    });

    test('should parse reasoning content with thinking and tool calls', () => {
      const content = `<tool_call>Let me check the weather for you.<tool_call><｜tool▁calls▁begin｜><｜tool▁call▁begin｜>get_weather<｜tool▁sep｜>{"location": "San Francisco"}<｜tool▁call▁end｜><｜tool▁calls▁end｜>`;
      const result = DeepSeekTagParser.parseReasoningContent(content);
      
      expect(result.hasSpecialTags).toBe(true);
      expect(result.thoughts).toHaveLength(1);
      expect(result.thoughts[0]).toBe('Let me check the weather for you.');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('get_weather');
      expect(result.toolCalls[0].arguments).toBe('{"location": "San Francisco"}');
    });

    test('should parse reasoning content with raw content, thinking and tool calls', () => {
      const content = `Here's my thought process:<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>get_weather<｜tool▁sep｜>{"location": "San Francisco"}<｜tool▁call▁end｜><｜tool▁calls▁end｜>Now I'll check the weather.`;
      const result = DeepSeekTagParser.parseReasoningContent(content);
      
      expect(result.hasSpecialTags).toBe(true);
      expect(result.rawContent).toHaveLength(2);
      expect(result.rawContent[0]).toBe('Here\'s my thought process:');
      expect(result.rawContent[1]).toBe('Now I\'ll check the weather.');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('get_weather');
      expect(result.toolCalls[0].arguments).toBe('{"location": "San Francisco"}');
    });
  });

  describe('parseToolCallContent', () => {
    test('should parse tool call with separator', () => {
      const toolContent = `get_weather<｜tool▁sep｜>{"location": "San Francisco"}`;
      const result = DeepSeekTagParser['parseToolCallContent'](toolContent);
      
      expect(result.name).toBe('get_weather');
      expect(result.arguments).toBe('{"location": "San Francisco"}');
    });

    test('should parse tool call with complex arguments', () => {
      const toolContent = `search<｜tool▁sep｜>{"query": "latest news", "count": 5}`;
      const result = DeepSeekTagParser['parseToolCallContent'](toolContent);
      
      expect(result.name).toBe('search');
      expect(result.arguments).toBe('{"query": "latest news", "count": 5}');
    });

    test('should handle tool call with no arguments', () => {
      const toolContent = `ping<｜tool▁sep｜>{}`;
      const result = DeepSeekTagParser['parseToolCallContent'](toolContent);
      
      expect(result.name).toBe('ping');
      expect(result.arguments).toBe('{}');
    });
  });

  describe('cleanContent', () => {
    test('should remove all DeepSeek tags from content', () => {
      const content = `<tool_call>Thinking about the request...<tool_call><｜tool▁calls▁begin｜><｜tool▁call▁begin｜>get_weather<｜tool▁sep｜>{"location": "San Francisco"}<｜tool▁call▁end｜><｜tool▁calls▁end｜>`;
      const cleaned = DeepSeekTagParser.cleanContent(content);
      
      expect(cleaned).toBe('Thinking about the request...get_weather{"location": "San Francisco"}');
    });
  });
});