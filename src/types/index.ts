/**
 * Type definitions export barrel
 */

// Re-export all types
export * from './anthropic';
export * from './openai';
export * from './common';

// Type guards
export function isAnthropicError(obj: any): obj is import('./anthropic').AnthropicError {
  return obj && obj.type === 'error' && obj.error && typeof obj.error.type === 'string';
}

export function isOpenAIError(obj: any): obj is import('./openai').OpenAIError {
  return obj && obj.error && typeof obj.error.message === 'string';
}

export function isAnthropicStreamChunk(obj: any): obj is import('./anthropic').AnthropicStreamChunk {
  return obj && typeof obj.type === 'string' && [
    'message_start',
    'content_block_start', 
    'content_block_delta',
    'content_block_stop',
    'message_delta',
    'message_stop'
  ].includes(obj.type);
}

export function isOpenAIStreamChunk(obj: any): obj is import('./openai').OpenAIStreamChunk {
  return obj && obj.object === 'chat.completion.chunk' && Array.isArray(obj.choices);
}