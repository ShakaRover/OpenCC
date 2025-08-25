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
} from './api-provider.interface';

// Export ProtocolType as both type and value
export { ProtocolType } from './api-provider.interface';
export type { ProtocolType as ProtocolTypeType } from './api-provider.interface';

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
} from './protocol-endpoints';

// URL builder utilities
export {
  URLBuilder,
  URLBuilderInstance
} from './url-builder';

// Base provider implementation
export {
  BaseProvider
} from './base-provider';

// Re-export protocol types for convenience
// (removed duplicate export)