/**
 * OpenAI API Type Definitions
 * Based on the official OpenAI API documentation
 */

export type OpenAIRole = 'system' | 'user' | 'assistant' | 'tool';

export type OpenAIFinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter';

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface OpenAIMessage {
  role: OpenAIRole;
  content: string | null;
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  reasoning_content?: string; // DeepSeek reasoning content extension
}

export interface OpenAIFunctionParameters {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
}

export interface OpenAIFunction {
  name: string;
  description: string;
  parameters: OpenAIFunctionParameters;
}

export interface OpenAITool {
  type: 'function';
  function: OpenAIFunction;
}

export type OpenAIToolChoice = 
  | 'auto' 
  | 'none' 
  | {
      type: 'function';
      function: {
        name: string;
      };
    };

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  tools?: OpenAITool[];
  tool_choice?: OpenAIToolChoice;
  response_format?: {
    type: 'text' | 'json_object';
  };
  seed?: number;
}

export interface OpenAIChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: OpenAIToolCall[];
    reasoning_content?: string; // DeepSeek reasoning content extension
  };
  finish_reason: OpenAIFinishReason;
  logprobs?: any;
}

export interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
  system_fingerprint?: string;
}

export interface OpenAIStreamChoice {
  index: number;
  delta: {
    role?: 'assistant';
    content?: string;
    reasoning_content?: string; // DeepSeek reasoning content extension
    tool_calls?: Array<{
      index?: number;
      id?: string;
      type?: 'function';
      function?: {
        name?: string;
        arguments?: string;
      };
    }>;
  };
  finish_reason?: OpenAIFinishReason;
  logprobs?: any;
}

export interface OpenAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: OpenAIStreamChoice[];
  usage?: OpenAIUsage;
  system_fingerprint?: string;
}

export interface OpenAIError {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

export interface OpenAIModelInfo {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

export interface OpenAIModelsResponse {
  object: 'list';
  data: OpenAIModelInfo[];
}

// Supported models based on design document
export type OpenAIModel =
  | 'gpt-4-turbo-preview'
  | 'gpt-4'
  | 'gpt-3.5-turbo'
  | 'gpt-4-0125-preview'
  | 'gpt-4-1106-preview'
  | 'gpt-3.5-turbo-0125'
  | 'gpt-3.5-turbo-1106';

// Constants
export const OPENAI_COMPLETION_ID_PREFIX = 'chatcmpl-';
export const OPENAI_DEFAULT_OBJECT = 'chat.completion';
export const OPENAI_STREAM_OBJECT = 'chat.completion.chunk';