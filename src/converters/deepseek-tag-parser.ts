/**
 * DeepSeek Reasoning Content 特殊标签解析器
 * 解析和处理 reasoning_content 中的特殊标签，如 , <｜tool▁calls▁begin｜> 等
 */

// DeepSeek特殊标签定义
export const DEEPSEEK_TAGS = {
  // 思维标签
  THINK_START: '``',
  THINK_END: '``',
  
  // 工具调用标签
  TOOL_CALLS_BEGIN: '<｜tool▁calls▁begin｜>',
  TOOL_CALLS_END: '<｜tool▁calls▁end｜>',
  TOOL_CALL_BEGIN: '<｜tool▁call▁begin｜>',
  TOOL_CALL_END: '<｜tool▁call▁end｜>',
  TOOL_CALL_SEP: '<｜tool▁sep｜>', // 工具调用分隔符
  
  // 其他可能的标签
  REASONING_START: '<reasoning>',
  REASONING_END: '</reasoning>'
} as const;

// 解析后的推理内容结构
export interface ParsedReasoningContent {
  thoughts: string[];           // 思维过程片段
  toolCalls: Array<{            // 工具调用片段信息
    name: string;               // 工具名称
    arguments: string;          // 工具参数（JSON字符串）
  }>;
  rawContent: string[];        // 原始内容片段
  hasSpecialTags: boolean;      // 是否包含特殊标签
}

// 流式标签状态管理
export interface StreamTagState {
  currentTag?: string;
  buffer: string;
  isInTag: boolean;
  tagStartIndex?: number;
}

// 流式标签处理结果
export interface StreamTagResult {
  tagType?: 'thinking' | 'tool_reasoning' | 'reasoning';
  content: string;
  isTagStart: boolean;
  isTagEnd: boolean;
  cleanedContent: string;       // 清理标签后的内容
}

/**
 * DeepSeek 标签解析器
 */
export class DeepSeekTagParser {
  
  /**
   * 解析推理内容中的特殊标签
   */
  static parseReasoningContent(content: string): ParsedReasoningContent {
    const result: ParsedReasoningContent = {
      thoughts: [],
      toolCalls: [],
      rawContent: [],
      hasSpecialTags: false
    };
    
    if (!content || !content.trim()) {
      return result;
    }
    
    // 检查是否包含特殊标签
    const hasSpecialTags = this.detectSpecialTags(content);
    result.hasSpecialTags = hasSpecialTags;
    
    if (!hasSpecialTags) {
      // 没有特殊标签，直接返回原始内容
      result.rawContent.push(content);
      return result;
    }
    
    // 按标签分割内容
    const segments = this.splitByTags(content);
    
    // 解析每个段落
    let i = 0;
    while (i < segments.length) {
      const segment = segments[i];
      
      if (segment === DEEPSEEK_TAGS.THINK_START) {
        // 找到思考标签的结束
        const endIndex = segments.indexOf(DEEPSEEK_TAGS.THINK_END, i + 1);
        if (endIndex !== -1) {
          // 提取思考内容
          const thinkingContent = segments.slice(i + 1, endIndex).join('');
          if (thinkingContent.trim()) {
            result.thoughts.push(thinkingContent.trim());
          }
          i = endIndex + 1;
        } else {
          // 没有结束标签，取后面所有内容
          const thinkingContent = segments.slice(i + 1).join('');
          if (thinkingContent.trim()) {
            result.thoughts.push(thinkingContent.trim());
          }
          break;
        }
      } else if (segment === DEEPSEEK_TAGS.TOOL_CALLS_BEGIN) {
        // 找到工具调用标签的结束
        const endIndex = segments.indexOf(DEEPSEEK_TAGS.TOOL_CALLS_END, i + 1);
        
        if (endIndex !== -1) {
          // 提取工具调用内容
          const toolCallsContent = segments.slice(i + 1, endIndex).join('');
          if (toolCallsContent.trim()) {
            // 解析工具调用内容中的多个工具调用
            this.parseToolCalls(toolCallsContent, result.toolCalls);
          }
          i = endIndex + 1;
        } else {
          // 没有结束标签，取后面所有内容
          const toolCallsContent = segments.slice(i + 1).join('');
          if (toolCallsContent.trim()) {
            // 解析工具调用内容中的多个工具调用
            this.parseToolCalls(toolCallsContent, result.toolCalls);
          }
          break;
        }
      } else if (!Object.values(DEEPSEEK_TAGS).includes(segment as any)) {
        // 不是标签，是原始内容
        if (segment && segment.trim()) {
          result.rawContent.push(segment.trim());
        }
        i++;
      } else {
        // 是结束标签或其他标签，跳过
        i++;
      }
    }
    
    return result;
  }
  
  /**
   * 解析工具调用内容中的多个工具调用
   */
  private static parseToolCalls(toolCallsContent: string, toolCalls: Array<{ name: string; arguments: string }>) {
    // 按工具调用开始标签分割
    const toolCallSegments = toolCallsContent.split(DEEPSEEK_TAGS.TOOL_CALL_BEGIN);
    
    for (const segment of toolCallSegments) {
      if (segment.trim() && !segment.includes(DEEPSEEK_TAGS.TOOL_CALLS_BEGIN) && !segment.includes(DEEPSEEK_TAGS.TOOL_CALLS_END)) {
        // 移除工具调用结束标签
        const cleanSegment = segment.replace(DEEPSEEK_TAGS.TOOL_CALL_END, '').trim();
        if (cleanSegment) {
          // 解析工具调用内容（尝试提取工具名称和参数）
          const parsedToolCall = this.parseToolCallContent(cleanSegment);
          toolCalls.push(parsedToolCall);
        }
      }
    }
  }

  /**
   * 检测内容是否包含特殊标签
   */
  private static detectSpecialTags(content: string): boolean {
    return Object.values(DEEPSEEK_TAGS).some(tag => content.includes(tag));
  }
  
  /**
   * 按标签分割内容
   */
  private static splitByTags(content: string): string[] {
    const segments: string[] = [];
    let currentIndex = 0;
    
    while (currentIndex < content.length) {
      let nearestTagIndex = content.length;
      let nearestTag = '';
      
      // 找到最近的标签
      for (const tag of Object.values(DEEPSEEK_TAGS)) {
        const tagIndex = content.indexOf(tag, currentIndex);
        if (tagIndex !== -1 && tagIndex < nearestTagIndex) {
          nearestTagIndex = tagIndex;
          nearestTag = tag;
        }
      }
      
      // 如果找到标签
      if (nearestTagIndex < content.length) {
        // 添加标签前的内容
        if (nearestTagIndex > currentIndex) {
          const beforeTag = content.substring(currentIndex, nearestTagIndex);
          if (beforeTag.trim()) {
            segments.push(beforeTag);
          }
        }
        
        // 添加标签本身
        segments.push(nearestTag);
        currentIndex = nearestTagIndex + nearestTag.length;
      } else {
        // 没有更多标签，添加剩余内容
        const remaining = content.substring(currentIndex);
        if (remaining.trim()) {
          segments.push(remaining);
        }
        break;
      }
    }
    
    return segments;
  }
  
  /**
   * 解析工具调用内容，提取工具名称和参数
   * 支持 DeepSeek 工具调用格式：tool_name<｜tool▁sep｜>tool_arguments
   */
  private static parseToolCallContent(toolContent: string): { name: string; arguments: string } {
    // 尝试解析为 JSON 格式（标准格式）
    try {
      const parsed = JSON.parse(toolContent);
      if (typeof parsed === 'object' && parsed !== null) {
        // 如果是对象，尝试提取 name 和 arguments
        const name = parsed.name || parsed.function || 'unknown_tool';
        const args = parsed.arguments || parsed.parameters || {};
        return {
          name: typeof name === 'string' ? name : 'unknown_tool',
          arguments: typeof args === 'object' ? JSON.stringify(args) : String(args)
        };
      }
    } catch (e) {
      // 不是有效的 JSON，继续其他解析方式
    }
    
    // 尝试解析 DeepSeek 工具调用格式：tool_name<｜tool▁sep｜>tool_arguments
    const sepIndex = toolContent.indexOf(DEEPSEEK_TAGS.TOOL_CALL_SEP);
    if (sepIndex !== -1) {
      const name = toolContent.substring(0, sepIndex).trim();
      const args = toolContent.substring(sepIndex + DEEPSEEK_TAGS.TOOL_CALL_SEP.length).trim();
      return {
        name: name || 'unknown_tool',
        arguments: args || '{}'
      };
    }
    
    // 尝试解析为 "工具名: 参数" 格式
    const colonIndex = toolContent.indexOf(':');
    if (colonIndex !== -1) {
      const name = toolContent.substring(0, colonIndex).trim();
      const args = toolContent.substring(colonIndex + 1).trim();
      return {
        name: name || 'unknown_tool',
        arguments: args || '{}'
      };
    }
    
    // 默认情况：将整个内容作为工具名称，空参数
    return {
      name: toolContent.trim() || 'unknown_tool',
      arguments: '{}'
    };
  }
  
  /**
   * 检查是否为思维片段
   */
  private static isThinkingSegment(segment: string): boolean {
    return segment.includes(DEEPSEEK_TAGS.THINK_START) || 
           segment.includes(DEEPSEEK_TAGS.THINK_END);
  }
  
  /**
   * 检查是否为工具调用片段
   */
  private static isToolCallSegment(segment: string): boolean {
    return segment.includes(DEEPSEEK_TAGS.TOOL_CALLS_BEGIN) ||
           segment.includes(DEEPSEEK_TAGS.TOOL_CALLS_END) ||
           segment.includes(DEEPSEEK_TAGS.TOOL_CALL_BEGIN) ||
           segment.includes(DEEPSEEK_TAGS.TOOL_CALL_END);
  }
  
  /**
   * 提取思维内容
   */
  private static extractThinkingContent(segment: string): string | null {
    const startTag = DEEPSEEK_TAGS.THINK_START;
    const endTag = DEEPSEEK_TAGS.THINK_END;
    
    const startIndex = segment.indexOf(startTag);
    const endIndex = segment.indexOf(endTag);
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      return segment.substring(startIndex + startTag.length, endIndex).trim();
    }
    
    // 如果只有开始标签，返回标签后的内容
    if (startIndex !== -1) {
      return segment.substring(startIndex + startTag.length).trim();
    }
    
    // 如果只有结束标签，返回标签前的内容
    if (endIndex !== -1) {
      return segment.substring(0, endIndex).trim();
    }
    
    return null;
  }
  
  /**
   * 提取工具调用内容
   */
  private static extractToolCallContent(segment: string): string | null {
    // 尝试匹配完整的工具调用块
    const beginTag = DEEPSEEK_TAGS.TOOL_CALLS_BEGIN;
    const endTag = DEEPSEEK_TAGS.TOOL_CALLS_END;
    
    let startIndex = segment.indexOf(beginTag);
    let endIndex = segment.indexOf(endTag);
    
    if (startIndex === -1) {
      startIndex = segment.indexOf(DEEPSEEK_TAGS.TOOL_CALL_BEGIN);
    }
    
    if (endIndex === -1) {
      endIndex = segment.indexOf(DEEPSEEK_TAGS.TOOL_CALL_END);
    }
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const startTagLength = segment.includes(beginTag) ? beginTag.length : DEEPSEEK_TAGS.TOOL_CALL_BEGIN.length;
      return segment.substring(startIndex + startTagLength, endIndex).trim();
    }
    
    // 如果只有开始标签
    if (startIndex !== -1) {
      const startTagLength = segment.includes(beginTag) ? beginTag.length : DEEPSEEK_TAGS.TOOL_CALL_BEGIN.length;
      return segment.substring(startIndex + startTagLength).trim();
    }
    
    // 如果只有结束标签
    if (endIndex !== -1) {
      return segment.substring(0, endIndex).trim();
    }
    
    return null;
  }
  
  /**
   * 生成组合的文本内容
   * 将解析后的各部分按一定格式组合
   */
  static combineReasoningContent(parsed: ParsedReasoningContent): string {
    if (!parsed.hasSpecialTags) {
      return parsed.rawContent.join('').trim();
    }
    
    const parts: string[] = [];
    
    // 添加思维过程（如果有）
    if (parsed.thoughts.length > 0) {
      parts.push(...parsed.thoughts);
    }
    
    // 添加工具调用信息（如果有）
    if (parsed.toolCalls.length > 0) {
      parsed.toolCalls.forEach(toolCall => {
        parts.push(`Tool call: ${toolCall.name}(${toolCall.arguments})`);
      });
    }
    
    // 添加原始内容（如果有）
    if (parsed.rawContent.length > 0) {
      parts.push(...parsed.rawContent);
    }
    
    return parts.join('\n').trim();
  }
  
  /**
   * 清理内容中的标签，返回纯文本
   */
  static cleanContent(content: string): string {
    if (!content) return '';
    
    let cleaned = content;
    
    // 移除所有特殊标签
    Object.values(DEEPSEEK_TAGS).forEach(tag => {
      const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tagRegex = new RegExp(escapedTag, 'g');
      cleaned = cleaned.replace(tagRegex, '');
    });
    
    // 特殊处理思维标签，因为开始和结束标签相同
    const thinkTagRegex = new RegExp(DEEPSEEK_TAGS.THINK_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    cleaned = cleaned.replace(thinkTagRegex, '');
    
    // 清理多余的空白
    cleaned = cleaned.replace(/\n\s*\n/g, '\n').trim();
    
    return cleaned;
  }
}

/**
 * 流式标签解析器
 * 用于处理流式响应中的标签状态跟踪
 */
export class StreamingTagParser {
  private state: StreamTagState = {
    buffer: '',
    isInTag: false
  };
  
  /**
   * 处理流式内容块
   */
  processChunk(delta: string): StreamTagResult {
    this.state.buffer += delta;
    
    const result: StreamTagResult = {
      content: delta,
      isTagStart: false,
      isTagEnd: false,
      cleanedContent: delta
    };
    
    // 检测标签开始
    if (!this.state.isInTag) {
      const tagStart = this.detectTagStart();
      if (tagStart) {
        this.state.isInTag = true;
        this.state.currentTag = tagStart.type;
        result.tagType = tagStart.type as any;
        result.isTagStart = true;
        result.cleanedContent = this.cleanCurrentBuffer();
        return result;
      }
    }
    
    // 检测标签结束
    if (this.state.isInTag && this.state.currentTag) {
      const tagEnd = this.detectTagEnd();
      if (tagEnd) {
        result.tagType = this.state.currentTag as any;
        result.isTagEnd = true;
        result.cleanedContent = this.extractAndCleanTagContent();
        this.resetState();
        return result;
      }
    }
    
    // 清理当前内容
    result.cleanedContent = DeepSeekTagParser.cleanContent(delta);
    
    return result;
  }
  
  /**
   * 检测标签开始
   */
  private detectTagStart(): { type: string; tag: string } | null {
    if (this.state.buffer.includes(DEEPSEEK_TAGS.THINK_START)) {
      return { type: 'thinking', tag: DEEPSEEK_TAGS.THINK_START };
    }
    
    if (this.state.buffer.includes(DEEPSEEK_TAGS.TOOL_CALLS_BEGIN)) {
      return { type: 'tool_reasoning', tag: DEEPSEEK_TAGS.TOOL_CALLS_BEGIN };
    }
    
    if (this.state.buffer.includes(DEEPSEEK_TAGS.TOOL_CALL_BEGIN)) {
      return { type: 'tool_reasoning', tag: DEEPSEEK_TAGS.TOOL_CALL_BEGIN };
    }
    
    return null;
  }
  
  /**
   * 检测标签结束
   */
  private detectTagEnd(): boolean {
    if (this.state.currentTag === 'thinking') {
      return this.state.buffer.includes(DEEPSEEK_TAGS.THINK_END);
    }
    
    if (this.state.currentTag === 'tool_reasoning') {
      return this.state.buffer.includes(DEEPSEEK_TAGS.TOOL_CALLS_END) ||
             this.state.buffer.includes(DEEPSEEK_TAGS.TOOL_CALL_END);
    }
    
    return false;
  }
  
  /**
   * 提取并清理标签内容
   */
  private extractAndCleanTagContent(): string {
    return DeepSeekTagParser.cleanContent(this.state.buffer);
  }
  
  /**
   * 清理当前缓冲区
   */
  private cleanCurrentBuffer(): string {
    return DeepSeekTagParser.cleanContent(this.state.buffer);
  }
  
  /**
   * 重置状态
   */
  private resetState(): void {
    this.state = {
      buffer: '',
      isInTag: false,
      currentTag: undefined
    };
  }
  
  /**
   * 手动重置状态（用于测试或多个标签序列）
   */
  reset(): void {
    this.resetState();
  }
  
  /**
   * 获取当前状态
   */
  getState(): Readonly<StreamTagState> {
    return { ...this.state };
  }
}