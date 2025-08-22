/**
 * Utility functions for OpenClaude protocol converter
 */

import { v4 as uuidv4 } from 'uuid';
import type { 
  AnthropicModel, 
  OpenAIModel, 
  ModelMapping,
  ANTHROPIC_MESSAGE_ID_PREFIX,
  OPENAI_COMPLETION_ID_PREFIX 
} from '@/types/index.js';

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return uuidv4();
}

/**
 * Generate Anthropic-style message ID
 */
export function generateAnthropicMessageId(): string {
  return `msg_${generateRandomString(24)}`;
}

/**
 * Generate OpenAI-style completion ID
 */
export function generateOpenAICompletionId(): string {
  return `chatcmpl-${generateRandomString(29)}`;
}

/**
 * Generate random string of specified length
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Get current Unix timestamp
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Validate temperature parameter for different APIs
 */
export function validateTemperature(temperature: number, targetApi: 'anthropic' | 'openai'): number {
  if (targetApi === 'anthropic') {
    // Anthropic: 0.0 - 1.0
    return Math.max(0, Math.min(1, temperature));
  } else {
    // OpenAI: 0.0 - 2.0
    return Math.max(0, Math.min(2, temperature));
  }
}

/**
 * Extract text content from mixed content array
 */
export function extractTextFromContent(content: string | any[]): string {
  if (typeof content === 'string') {
    return content;
  }
  
  if (Array.isArray(content)) {
    return content
      .filter(item => item.type === 'text')
      .map(item => item.text || '')
      .join('\n');
  }
  
  return '';
}

/**
 * Check if content contains unsupported types (audio/file)
 */
export function hasUnsupportedContent(content: any[]): { hasUnsupported: boolean; unsupportedTypes: string[] } {
  if (!Array.isArray(content)) {
    return { hasUnsupported: false, unsupportedTypes: [] };
  }
  
  const unsupportedTypes = content
    .map(item => item.type)
    .filter(type => ['input_audio', 'file'].includes(type));
    
  return {
    hasUnsupported: unsupportedTypes.length > 0,
    unsupportedTypes: [...new Set(unsupportedTypes)]
  };
}

/**
 * Flatten content array to string with metadata preservation
 */
export function flattenContentToString(content: string | any[]): string {
  if (typeof content === 'string') {
    return content;
  }
  
  if (!Array.isArray(content)) {
    return '';
  }
  
  const textParts: string[] = [];
  
  for (const item of content) {
    switch (item.type) {
      case 'text':
        textParts.push(item.text || '');
        break;
      case 'image':
        textParts.push('[Image content provided - analysis capabilities may vary]');
        break;
      case 'tool_use':
        textParts.push(`[Tool called: ${item.name}]`);
        break;
      case 'tool_result':
        if (typeof item.content === 'string') {
          textParts.push(item.content);
        }
        break;
    }
  }
  
  return textParts.join('\n').trim();
}

/**
 * Convert string content to Anthropic content array format
 */
export function stringToAnthropicContent(text: string): Array<{ type: 'text'; text: string }> {
  return [{ type: 'text', text }];
}

/**
 * Sanitize and validate JSON string
 */
export function safeJsonParse(jsonString: string, fallback: any = {}): any {
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Remove undefined properties from object
 */
export function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key as keyof T] = value;
    }
  }
  
  return result;
}

/**
 * Calculate token estimate (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to approximate token limit
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4; // Rough estimation
  if (text.length <= maxChars) {
    return text;
  }
  
  return text.substring(0, maxChars - 3) + '...';
}

/**
 * Format error message for logging
 */
export function formatErrorForLogging(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return JSON.stringify(error);
}

/**
 * Check if string is valid JSON
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate cache key for content caching
 */
export function generateCacheKey(content: string): string {
  // Simple hash function for cache keys
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}