/**
 * DeepSeek Reasoning Content 特殊标签解析器
 * 解析和处理 reasoning_content 中的特殊标签，如 , <｜tool▁calls▁begin｜> 等
 */

// DeepSeek特殊标签定义
export const DEEPSEEK_TAGS = {
  // 思维标签
  THINK_START: '<think>',
  THINK_END: '</think>',
  
  // 工具调用标签
  TOOL_CALLS_BEGIN: '<｜tool▁calls▁begin｜>',
  TOOL_CALLS_END: '<｜tool▁calls▁end｜>',
  TOOL_CALL_BEGIN: '<｜tool▁call▁begin｜>',
  TOOL_CALL_END: '<｜tool▁call▁end｜>',
  TOOL_CALL_SEP: '<｜tool▁sep｜>', // 工具调用分隔符
  
  // 其他可能的标签
  REASONING_START: '<reasoning>',
  REASONING_END: '</reasoning>',
  
  // 简化的工具调用标签（用于某些测试场景）
  TOOL_CALL_SIMPLE: '<tool_call>'
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
  tagStack: Array<{ type: string; tag: string; startIndex: number }>;
  partialTagMatch?: { tag: string; matchedLength: number };
  contentBuffer: string; // 存储已清理的内容
  tagContentBuffer: string; // 存储标签内容
}

// 流式标签处理结果
export interface StreamTagResult {
  tagType?: 'thinking' | 'tool_reasoning' | 'reasoning';
  content: string;
  isTagStart: boolean;
  isTagEnd: boolean;
  cleanedContent: string;       // 清理标签后的内容
  hasPartialTag: boolean;       // 是否包含部分标签
  extractedContent?: {          // 提取的标签内容
    thoughts: string[];
    toolCalls: Array<{ name: string; arguments: string }>;
    rawContent: string[];
  };
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
      } else if (segment === DEEPSEEK_TAGS.TOOL_CALL_SIMPLE) {
        // 处理简化的工具调用标签 <tool_call>
        // 查找下一个 <tool_call> 或其他标签作为结束点
        let endIndex = i + 1;
        while (endIndex < segments.length) {
          const nextSegment = segments[endIndex];
          if (Object.values(DEEPSEEK_TAGS).includes(nextSegment as any)) {
            break;
          }
          endIndex++;
        }
        
        // 提取简化工具调用内容
        const toolCallContent = segments.slice(i + 1, endIndex).join('');
        if (toolCallContent.trim()) {
          result.thoughts.push(toolCallContent.trim());
        }
        i = endIndex;
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
      
      // 特殊处理简化工具调用标签 <tool_call>
      const toolCallMatches = content.slice(currentIndex).match(/<tool_call>/g);
      if (toolCallMatches) {
        const toolCallIndex = content.indexOf('<tool_call>', currentIndex);
        if (toolCallIndex !== -1 && toolCallIndex < nearestTagIndex) {
          nearestTagIndex = toolCallIndex;
          nearestTag = '<tool_call>';
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
   * 支持多种 DeepSeek 工具调用格式：
   * 1. tool_name<｜tool▁sep｜>tool_arguments
   * 2. function<｜tool▁sep｜>ActualToolName\n```json\n"json_args"\n```
   * 3. JSON 格式: {"name": "tool", "arguments": {...}}
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
      const beforeSep = toolContent.substring(0, sepIndex).trim();
      const afterSep = toolContent.substring(sepIndex + DEEPSEEK_TAGS.TOOL_CALL_SEP.length).trim();
      
      // 检查是否为 function<｜tool▁sep｜>ActualToolName 格式
      if (beforeSep === 'function') {
        // 解析复杂格式：function<｜tool▁sep｜>ActualToolName\n```json\n"json_args"\n```
        const lines = afterSep.split('\n');
        const actualToolName = lines[0]?.trim() || 'unknown_tool';
        
        // 查找JSON内容
        const jsonMatch = afterSep.match(/```json\s*\n(.*?)\n```/s);
        if (jsonMatch && jsonMatch[1]) {
          let jsonStr = jsonMatch[1].trim();
          
          // 如果JSON字符串被额外的引号包围，移除它们
          if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
            try {
              // 尝试解析外层引号
              jsonStr = JSON.parse(jsonStr);
            } catch (e) {
              // 如果解析失败，保持原样
            }
          }
          
          return {
            name: actualToolName || 'unknown_tool',
            arguments: jsonStr || '{}'
          };
        } else {
          // 没有找到JSON格式，使用整个后续内容作为参数
          return {
            name: actualToolName || 'unknown_tool',
            arguments: afterSep.substring(actualToolName.length).trim() || '{}'
          };
        }
      } else {
        // 标准格式：tool_name<｜tool▁sep｜>tool_arguments
        return {
          name: beforeSep || 'unknown_tool',
          arguments: afterSep || '{}'
        };
      }
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
    isInTag: false,
    tagStack: [],
    contentBuffer: '',
    tagContentBuffer: ''
  };
  
  /**
   * 获取所有可能的标签，按长度排序（长的优先）
   */
  private getAllTags(): string[] {
    return Object.values(DEEPSEEK_TAGS).sort((a, b) => b.length - a.length);
  }
  
  /**
   * 检查是否存在部分标签匹配
   */
  private checkPartialTagMatch(buffer: string): { tag: string; matchedLength: number } | null {
    const tags = this.getAllTags();
    
    for (const tag of tags) {
      for (let i = 1; i <= Math.min(tag.length, buffer.length); i++) {
        const suffix = buffer.slice(-i);
        if (tag.startsWith(suffix)) {
          return { tag, matchedLength: i };
        }
      }
    }
    
    return null;
  }
  
  /**
   * 检查完整标签匹配
   */
  private findCompleteTagMatches(text: string): Array<{ tag: string; index: number; type: 'start' | 'end' }> {
    const matches: Array<{ tag: string; index: number; type: 'start' | 'end' }> = [];
    const tags = this.getAllTags();
    
    for (const tag of tags) {
      let index = 0;
      while ((index = text.indexOf(tag, index)) !== -1) {
        const type = this.getTagType(tag);
        matches.push({ tag, index, type });
        index += tag.length;
      }
    }
    
    // 按位置排序
    return matches.sort((a, b) => a.index - b.index);
  }
  
  /**
   * 判断标签类型（开始或结束）
   */
  private getTagType(tag: string): 'start' | 'end' {
    const endTags = [
      DEEPSEEK_TAGS.THINK_END,
      DEEPSEEK_TAGS.TOOL_CALLS_END,
      DEEPSEEK_TAGS.TOOL_CALL_END,
      DEEPSEEK_TAGS.REASONING_END
    ];
    
    return endTags.includes(tag as any) ? 'end' : 'start';
  }
  
  /**
   * 获取标签的语义类型
   */
  private getSemanticTagType(tag: string): 'thinking' | 'tool_reasoning' | 'reasoning' {
    if (tag === DEEPSEEK_TAGS.THINK_START || tag === DEEPSEEK_TAGS.THINK_END) {
      return 'thinking';
    }
    if (tag.includes('tool')) {
      return 'tool_reasoning';
    }
    return 'reasoning';
  }
  
  /**
   * 处理流式内容块
   */
  processChunk(delta: string): StreamTagResult {
    // 更新缓冲区
    this.state.buffer += delta;
    
    const result: StreamTagResult = {
      content: delta,
      isTagStart: false,
      isTagEnd: false,
      cleanedContent: delta,
      hasPartialTag: false
    };
    
    // 检查部分标签匹配
    const partialMatch = this.checkPartialTagMatch(this.state.buffer);
    if (partialMatch) {
      this.state.partialTagMatch = partialMatch;
      result.hasPartialTag = true;
      // 如果有部分匹配，暂时不输出内容，等待完整标签
      result.cleanedContent = '';
      return result;
    }
    
    // 检查完整标签匹配
    const tagMatches = this.findCompleteTagMatches(this.state.buffer);
    
    if (tagMatches.length === 0) {
      // 没有标签匹配，清理部分匹配状态
      this.state.partialTagMatch = undefined;
      
      if (this.state.isInTag) {
        // 在标签内，将内容添加到标签内容缓冲区
        this.state.tagContentBuffer += delta;
        result.cleanedContent = ''; // 标签内容不立即输出
      } else {
        // 不在标签内，直接输出清理后的内容
        this.state.contentBuffer += delta;
        result.cleanedContent = delta;
      }
      
      return result;
    }
    
    // 处理标签匹配
    return this.processTagMatches(tagMatches, result);
  }
  
  /**
   * 处理标签匹配
   */
  private processTagMatches(matches: Array<{ tag: string; index: number; type: 'start' | 'end' }>, result: StreamTagResult): StreamTagResult {
    let processedIndex = 0;
    let hasTagTransition = false;
    
    for (const match of matches) {
      const { tag, index, type } = match;
      const semanticType = this.getSemanticTagType(tag);
      
      if (type === 'start') {
        // 标签开始
        if (!this.state.isInTag) {
          // 提取标签前的内容
          const beforeTag = this.state.buffer.substring(processedIndex, index);
          if (beforeTag) {
            this.state.contentBuffer += beforeTag;
            result.cleanedContent += beforeTag;
          }
          
          // 开始标签
          this.state.isInTag = true;
          this.state.currentTag = semanticType;
          this.state.tagStack.push({ type: semanticType, tag, startIndex: index });
          this.state.tagContentBuffer = '';
          
          result.isTagStart = true;
          result.tagType = semanticType;
          hasTagTransition = true;
          
          processedIndex = index + tag.length;
        } else {
          // 嵌套标签处理
          this.state.tagStack.push({ type: semanticType, tag, startIndex: index });
        }
      } else {
        // 标签结束
        if (this.state.isInTag && this.state.tagStack.length > 0) {
          // 查找匹配的开始标签
          const matchingStartIndex = this.findMatchingStartTag(tag);
          
          if (matchingStartIndex !== -1) {
            // 提取标签内容
            const tagContent = this.state.buffer.substring(processedIndex, index);
            this.state.tagContentBuffer += tagContent;
            
            // 移除匹配的标签对
            this.state.tagStack.splice(matchingStartIndex, 1);
            
            // 如果标签栈为空，结束标签状态
            if (this.state.tagStack.length === 0) {
              this.state.isInTag = false;
              result.isTagEnd = true;
              result.tagType = semanticType;
              
              // 解析标签内容
              const extractedContent = this.extractTagContent(this.state.tagContentBuffer, semanticType);
              result.extractedContent = extractedContent;
              
              // 将解析后的内容添加到结果
              const combinedContent = this.combineExtractedContent(extractedContent);
              result.cleanedContent += combinedContent;
              this.state.contentBuffer += combinedContent;
              
              this.state.tagContentBuffer = '';
              hasTagTransition = true;
            }
            
            processedIndex = index + tag.length;
          }
        }
      }
    }
    
    // 处理剩余内容
    if (processedIndex < this.state.buffer.length) {
      const remaining = this.state.buffer.substring(processedIndex);
      
      if (this.state.isInTag) {
        this.state.tagContentBuffer += remaining;
      } else {
        this.state.contentBuffer += remaining;
        if (!hasTagTransition) {
          result.cleanedContent += remaining;
        }
      }
    }
    
    // 清理缓冲区（保留可能的部分标签）
    this.cleanupBuffer();
    
    return result;
  }
  
  /**
   * 查找匹配的开始标签
   */
  private findMatchingStartTag(endTag: string): number {
    const tagPairs = [
      [DEEPSEEK_TAGS.THINK_START, DEEPSEEK_TAGS.THINK_END],
      [DEEPSEEK_TAGS.TOOL_CALLS_BEGIN, DEEPSEEK_TAGS.TOOL_CALLS_END],
      [DEEPSEEK_TAGS.TOOL_CALL_BEGIN, DEEPSEEK_TAGS.TOOL_CALL_END],
      [DEEPSEEK_TAGS.REASONING_START, DEEPSEEK_TAGS.REASONING_END]
    ];
    
    let matchingStartTag = '';
    for (const [start, end] of tagPairs) {
      if (end === endTag && start) {
        matchingStartTag = start;
        break;
      }
    }
    
    if (!matchingStartTag) return -1;
    
    // 从栈顶向下查找匹配的开始标签
    for (let i = this.state.tagStack.length - 1; i >= 0; i--) {
      const stackTag = this.state.tagStack[i];
      if (stackTag && stackTag.tag === matchingStartTag) {
        return i;
      }
    }
    
    return -1;
  }
  
  /**
   * 提取标签内容
   */
  private extractTagContent(content: string, tagType: 'thinking' | 'tool_reasoning' | 'reasoning'): {
    thoughts: string[];
    toolCalls: Array<{ name: string; arguments: string }>;
    rawContent: string[];
  } {
    const result = {
      thoughts: [] as string[],
      toolCalls: [] as Array<{ name: string; arguments: string }>,
      rawContent: [] as string[]
    };
    
    if (!content.trim()) return result;
    
    if (tagType === 'thinking') {
      result.thoughts.push(content.trim());
    } else if (tagType === 'tool_reasoning') {
      // 尝试解析工具调用
      const parsedToolCall = this.parseSimpleToolCall(content);
      if (parsedToolCall) {
        result.toolCalls.push(parsedToolCall);
      } else {
        result.rawContent.push(content.trim());
      }
    } else {
      result.rawContent.push(content.trim());
    }
    
    return result;
  }
  
  /**
   * 简单的工具调用解析
   */
  private parseSimpleToolCall(content: string): { name: string; arguments: string } | null {
    // 尝试 JSON 格式
    try {
      const parsed = JSON.parse(content);
      if (parsed.name || parsed.function) {
        return {
          name: parsed.name || parsed.function || 'unknown_tool',
          arguments: JSON.stringify(parsed.arguments || parsed.parameters || {})
        };
      }
    } catch (e) {
      // 继续其他格式解析
    }
    
    // 尝试分隔符格式
    const sepIndex = content.indexOf(DEEPSEEK_TAGS.TOOL_CALL_SEP);
    if (sepIndex !== -1) {
      return {
        name: content.substring(0, sepIndex).trim() || 'unknown_tool',
        arguments: content.substring(sepIndex + DEEPSEEK_TAGS.TOOL_CALL_SEP.length).trim() || '{}'
      };
    }
    
    return null;
  }
  
  /**
   * 组合提取的内容
   */
  private combineExtractedContent(extracted: {
    thoughts: string[];
    toolCalls: Array<{ name: string; arguments: string }>;
    rawContent: string[];
  }): string {
    const parts: string[] = [];
    
    // 添加思考内容
    parts.push(...extracted.thoughts);
    
    // 添加工具调用信息
    extracted.toolCalls.forEach(toolCall => {
      parts.push(`Tool call: ${toolCall.name}(${toolCall.arguments})`);
    });
    
    // 添加原始内容
    parts.push(...extracted.rawContent);
    
    return parts.join('\n');
  }
  
  /**
   * 清理缓冲区
   */
  private cleanupBuffer(): void {
    // 保留最后可能形成部分标签的字符
    const maxTagLength = Math.max(...Object.values(DEEPSEEK_TAGS).map(tag => tag.length));
    
    if (this.state.buffer.length > maxTagLength * 2) {
      const keepLength = maxTagLength;
      this.state.buffer = this.state.buffer.slice(-keepLength);
    }
  }
  
  /**
   * 重置状态
   */
  private resetState(): void {
    this.state = {
      buffer: '',
      isInTag: false,
      tagStack: [],
      contentBuffer: '',
      tagContentBuffer: ''
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
  
  /**
   * 完成处理，返回最终结果
   */
  finalize(): StreamTagResult {
    const result: StreamTagResult = {
      content: '',
      isTagStart: false,
      isTagEnd: false,
      cleanedContent: this.state.contentBuffer,
      hasPartialTag: false
    };
    
    // 如果还在标签内，将标签内容作为原始内容输出
    if (this.state.isInTag && this.state.tagContentBuffer) {
      const extractedContent = this.extractTagContent(
        this.state.tagContentBuffer, 
        this.state.currentTag as any || 'reasoning'
      );
      result.extractedContent = extractedContent;
      
      const combinedContent = this.combineExtractedContent(extractedContent);
      result.cleanedContent += combinedContent;
    }
    
    return result;
  }
}