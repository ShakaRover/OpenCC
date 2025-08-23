/**
 * Base Provider Module Exports
 * Centralized exports for base provider interfaces and utilities
 */

// Core interfaces
export type {
  APIProvider,
  AuthProvider,
  ConfigProvider,
  APIEndpoint,
  ProtocolEndpoints,
  URLBuildOptions,
  ProviderHealthStatus,
  ProviderCapabilities,
  ProviderContext,
  ProviderError,
  HttpMethod
} from './api-provider.interface.js';

// Export ProtocolType as both type and value
export { ProtocolType } from './api-provider.interface.js';
export type { ProtocolType as ProtocolTypeType } from './api-provider.interface.js';

// Protocol endpoints
export {
  OPENAI_ENDPOINTS,
  GEMINI_ENDPOINTS,
  ANTHROPIC_ENDPOINTS,
  CLAUDE_ENDPOINTS,
  PROTOCOL_ENDPOINTS,
  getProtocolEndpoints,
  getEndpoint,
  supportsEndpoint,
  getSupportedEndpoints
} from './protocol-endpoints.js';

// URL builder utilities
export {
  URLBuilder,
  URLBuilderInstance
} from './url-builder.js';

// Base provider implementation
export {
  BaseProvider
} from './base-provider.js';

// Re-export protocol types for convenience
// (removed duplicate export)