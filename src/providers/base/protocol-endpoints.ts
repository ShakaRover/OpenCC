/**
 * Protocol Endpoint Configurations
 * Defines endpoint structures for different API protocols
 */

import type { ProtocolEndpoints, APIEndpoint } from './api-provider.interface.js';
import { ProtocolType } from './api-provider.interface.js';

/**
 * OpenAI Protocol Endpoints (also used by Qwen and other OpenAI-compatible APIs)
 */
export const OPENAI_ENDPOINTS: ProtocolEndpoints = {
  chat: {
    type: 'chat',
    method: 'POST',
    path: '/v1/chat/completions'
  },
  models: {
    type: 'models',
    method: 'GET',
    path: '/v1/models'
  },
  health: {
    type: 'health',
    method: 'GET',
    path: '/v1/health'
  },
  embeddings: {
    type: 'embeddings',
    method: 'POST',
    path: '/v1/embeddings'
  }
};

/**
 * Gemini Protocol Endpoints
 */
export const GEMINI_ENDPOINTS: ProtocolEndpoints = {
  chat: {
    type: 'chat',
    method: 'POST',
    path: '/v1beta/models/{model}:generateContent',
    requiresModel: true,
    modelPlacement: 'path',
    pathVariables: ['model']
  },
  models: {
    type: 'models',
    method: 'GET',
    path: '/v1beta/models'
  },
  custom: {
    streamChat: {
      type: 'custom',
      method: 'POST',
      path: '/v1beta/models/{model}:streamGenerateContent',
      requiresModel: true,
      modelPlacement: 'path',
      pathVariables: ['model']
    }
  }
};

/**
 * Anthropic Protocol Endpoints
 */
export const ANTHROPIC_ENDPOINTS: ProtocolEndpoints = {
  chat: {
    type: 'chat',
    method: 'POST',
    path: '/v1/messages'
  },
  models: {
    type: 'models',
    method: 'GET',
    path: '/v1/models'
  },
  health: {
    type: 'health',
    method: 'GET',
    path: '/v1/health'
  }
};

/**
 * Claude Protocol Endpoints (similar to Anthropic but with different base paths)
 */
export const CLAUDE_ENDPOINTS: ProtocolEndpoints = {
  chat: {
    type: 'chat',
    method: 'POST',
    path: '/v1/messages'
  },
  models: {
    type: 'models',
    method: 'GET',
    path: '/v1/models'
  }
};

/**
 * Protocol endpoints registry
 */
export const PROTOCOL_ENDPOINTS: Record<ProtocolType, ProtocolEndpoints> = {
  [ProtocolType.OPENAI]: OPENAI_ENDPOINTS,
  [ProtocolType.GEMINI]: GEMINI_ENDPOINTS,
  [ProtocolType.ANTHROPIC]: ANTHROPIC_ENDPOINTS,
  [ProtocolType.CLAUDE]: CLAUDE_ENDPOINTS,
  [ProtocolType.CUSTOM]: OPENAI_ENDPOINTS // Default to OpenAI for custom providers
};

/**
 * Get endpoints for a specific protocol
 */
export function getProtocolEndpoints(protocol: ProtocolType): ProtocolEndpoints {
  const endpoints = PROTOCOL_ENDPOINTS[protocol];
  if (!endpoints) {
    throw new Error(`Unsupported protocol: ${protocol}`);
  }
  return endpoints;
}

/**
 * Get specific endpoint for a protocol
 */
export function getEndpoint(
  protocol: ProtocolType, 
  endpointType: keyof ProtocolEndpoints
): APIEndpoint {
  const endpoints = getProtocolEndpoints(protocol);
  const endpoint = endpoints[endpointType];
  
  if (!endpoint) {
    throw new Error(`Endpoint '${endpointType}' not supported by protocol '${protocol}'`);
  }
  
  // Handle custom endpoints which might be a Record
  if (endpointType === 'custom' && typeof endpoint === 'object' && !('type' in endpoint)) {
    throw new Error(`Custom endpoints must be accessed by specific key, not '${endpointType}'`);
  }
  
  return endpoint as APIEndpoint;
}

/**
 * Check if a protocol supports a specific endpoint type
 */
export function supportsEndpoint(
  protocol: ProtocolType, 
  endpointType: keyof ProtocolEndpoints
): boolean {
  try {
    const endpoints = getProtocolEndpoints(protocol);
    return endpoints[endpointType] !== undefined;
  } catch {
    return false;
  }
}

/**
 * Get all supported endpoint types for a protocol
 */
export function getSupportedEndpoints(protocol: ProtocolType): string[] {
  try {
    const endpoints = getProtocolEndpoints(protocol);
    return Object.keys(endpoints);
  } catch {
    return [];
  }
}