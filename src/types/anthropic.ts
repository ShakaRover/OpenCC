/**
 * Anthropic API Type Definitions
 * Based on the official Anthropic API documentation
 */

export type AnthropicRole = 'user' | 'assistant';

export type AnthropicContentType = 'text' | 'image' | 'tool_use' | 'tool_result';

export type AnthropicStopReason = 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';

export interface AnthropicImageSource {
  type: 'base64';
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data: string;
}

export interface AnthropicTextContent {
  type: 'text';
  text: string;
  cache_control?: {
    type: 'ephemeral';
  };
}

export interface AnthropicImageContent {
  type: 'image';
  source: AnthropicImageSource;
}

export interface AnthropicToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface AnthropicToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content?: string | AnthropicContent[];
  is_error?: boolean;
}

export type AnthropicContent =
  | AnthropicTextContent
  | AnthropicImageContent
  | AnthropicToolUseContent
  | AnthropicToolResultContent;

export interface AnthropicMessage {
  role: AnthropicRole;
  content: string | AnthropicContent[];
}

export interface AnthropicToolInputSchema {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: AnthropicToolInputSchema;
}

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stream?: boolean;
  stop_sequences?: string[];
  tools?: AnthropicTool[];
  tool_choice?: {
    type: 'auto' | 'any' | 'tool';
    name?: string;
  };
  anthropic_version?: string;
  metadata?: {
    user_id?: string;
    [key: string]: any;
  };
}

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContent[];
  model: string;
  stop_reason: AnthropicStopReason;
  stop_sequence?: string;
  usage: AnthropicUsage;
}

export interface AnthropicStreamChunk {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop';
  message?: Partial<AnthropicResponse>;
  content_block?: {
    type: string;
    text?: string;
  };
  delta?: {
    type: 'text_delta' | 'input_json_delta';
    text?: string;
    partial_json?: string;
    stop_reason?: AnthropicStopReason;
    stop_sequence?: string;
    usage?: Partial<AnthropicUsage>;
  };
  index?: number;
}

export interface AnthropicError {
  type: 'error';
  error: {
    type: 'invalid_request_error' | 'authentication_error' | 'rate_limit_error' | 'api_error' | 'not_supported_error' | 'timeout_error' | 'network_error';
    message: string;
  };
}

// Supported models based on design document
export type AnthropicModel =
  | 'claude-3-opus-20240229'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307'
  | 'claude-instant-1.2'
  | 'claude-opus-4-20250514';

// Version constants
export const ANTHROPIC_API_VERSION = 'bedrock-2023-05-31';
export const ANTHROPIC_MESSAGE_ID_PREFIX = 'msg_';