/**
 * Error Handling Middleware
 * Handles and formats errors consistently across the application
 * Enhanced to support provider-specific error formats
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/helpers';
import type { AnthropicError, StandardError } from '@/types';
import type { ProviderError } from '@/providers';

/**
 * Global error handler middleware
 * Must be registered last in middleware chain
 */
export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If response was already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  // Log error with provider context if available
  const errorContext = {
    error: error.message || error,
    stack: error.stack,
    url: req.url,
    method: req.method,
    provider: req.provider?.name,
    protocol: req.provider?.protocol,
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  };
  
  logger.error('Error handler caught error', errorContext);

  // Convert error to Anthropic format with request context
  const anthropicError = convertToAnthropicError(error, req);
  const statusCode = getErrorStatusCode(anthropicError.error.type);

  res.status(statusCode).json(anthropicError);
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch Promise rejections
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found handler
 * Handles 404 errors for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  const anthropicError: AnthropicError = {
    type: 'error',
    error: {
      type: 'invalid_request_error',
      message: `Not found: ${req.method} ${req.path}`
    }
  };

  res.status(404).json(anthropicError);
}

/**
 * Provider error handler
 * Handles provider-specific errors
 */
export function providerErrorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Handle ProviderError specifically
  if (error.name === 'ProviderError' || (error.provider && error.code)) {
    const providerError = error as ProviderError;
    
    logger.error('Provider error occurred', {
      provider: providerError.provider,
      code: providerError.code,
      message: providerError.message,
      statusCode: providerError.statusCode,
      details: providerError.details,
      requestId: req.requestId
    });
    
    const anthropicError: AnthropicError = {
      type: 'error',
      error: {
        type: mapProviderErrorType(providerError.code),
        message: `${providerError.provider} error: ${providerError.message}`
      }
    };
    
    const statusCode = providerError.statusCode || getErrorStatusCode(anthropicError.error.type);
    res.status(statusCode).json(anthropicError);
    return;
  }
  
  next(error);
}

/**
 * Validation error handler
 * Handles request validation errors
 */
export function validationErrorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error.name === 'ValidationError' || error.type === 'validation') {
    const anthropicError: AnthropicError = {
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: `Validation error: ${error.message}`
      }
    };

    res.status(400).json(anthropicError);
    return;
  }

  next(error);
}

/**
 * Timeout error handler
 * Handles request timeout errors
 */
export function timeoutErrorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error.code === 'TIMEOUT' || error.timeout) {
    const anthropicError: AnthropicError = {
      type: 'error',
      error: {
        type: 'timeout_error',
        message: 'Request timeout. Please try again.'
      }
    };

    res.status(408).json(anthropicError);
    return;
  }

  next(error);
}

/**
 * Convert various error types to Anthropic error format
 * Enhanced to support multiple provider error formats
 */
function convertToAnthropicError(error: any, req?: Request): AnthropicError {
  // Already an Anthropic error
  if (error.type === 'error' && error.error) {
    return error;
  }
  
  // ProviderError
  if (error.name === 'ProviderError' || (error.provider && error.code)) {
    const providerError = error as ProviderError;
    return {
      type: 'error',
      error: {
        type: mapProviderErrorType(providerError.code),
        message: `${providerError.provider} error: ${providerError.message}`
      }
    };
  }

  // OpenAI API error format
  if (error.error && error.error.message) {
    return {
      type: 'error',
      error: {
        type: mapOpenAIErrorType(error.error.type),
        message: error.error.message
      }
    };
  }
  
  // Qwen API error format (similar to OpenAI)
  if (error.code && error.message && typeof error.code === 'string') {
    return {
      type: 'error',
      error: {
        type: mapQwenErrorType(error.code),
        message: error.message
      }
    };
  }
  
  // Gemini API error format (future support)
  if (error.error && error.error.code && error.error.message) {
    return {
      type: 'error',
      error: {
        type: mapGeminiErrorType(error.error.code),
        message: error.error.message
      }
    };
  }

  // Fetch/Network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return {
      type: 'error',
      error: {
        type: 'network_error',
        message: 'Network connection error. Please check your internet connection.'
      }
    };
  }

  // Axios error
  if (error.response && error.response.data) {
    const data = error.response.data;
    if (data.error) {
      return {
        type: 'error',
        error: {
          type: mapOpenAIErrorType(data.error.type || 'api_error'),
          message: data.error.message || 'External API error'
        }
      };
    }
    return {
      type: 'error',
      error: {
        type: 'api_error',
        message: data.message || 'External API error'
      }
    };
  }

  // Network error
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return {
      type: 'error',
      error: {
        type: 'network_error',
        message: 'Network connection error. Please check your internet connection.'
      }
    };
  }

  // Rate limit error
  if (error.status === 429 || error.statusCode === 429) {
    return {
      type: 'error',
      error: {
        type: 'rate_limit_error',
        message: 'Rate limit exceeded. Please slow down your requests.'
      }
    };
  }

  // Authentication error
  if (error.status === 401 || error.statusCode === 401) {
    return {
      type: 'error',
      error: {
        type: 'authentication_error',
        message: 'Authentication failed. Please check your API key.'
      }
    };
  }
  
  // Provider-specific timeout
  if (error.code === 'TIMEOUT' || error.timeout || error.name === 'TimeoutError') {
    return {
      type: 'error',
      error: {
        type: 'timeout_error',
        message: 'Request timeout. Please try again.'
      }
    };
  }

  // Generic error
  return {
    type: 'error',
    error: {
      type: 'api_error',
      message: error.message || 'An unexpected error occurred'
    }
  };
}

/**
 * Map provider error codes to Anthropic error types
 */
function mapProviderErrorType(providerCode: string): AnthropicError['error']['type'] {
  switch (providerCode.toUpperCase()) {
    case 'AUTH_ERROR':
    case 'AUTH_INVALID':
    case 'AUTHENTICATION_ERROR':
      return 'authentication_error';
    case 'INVALID_REQUEST':
    case 'VALIDATION_ERROR':
    case 'INVALID_PARAMETER':
      return 'invalid_request_error';
    case 'RATE_LIMIT_ERROR':
    case 'RATE_LIMITED':
      return 'rate_limit_error';
    case 'TIMEOUT_ERROR':
    case 'REQUEST_TIMEOUT':
      return 'timeout_error';
    case 'NETWORK_ERROR':
    case 'CONNECTION_ERROR':
      return 'network_error';
    case 'NOT_SUPPORTED':
    case 'FEATURE_NOT_SUPPORTED':
      return 'not_supported_error';
    case 'API_ERROR':
    case 'SERVER_ERROR':
    case 'INTERNAL_ERROR':
    default:
      return 'api_error';
  }
}

/**
 * Map Qwen-specific error codes to Anthropic error types
 */
function mapQwenErrorType(qwenCode: string): AnthropicError['error']['type'] {
  switch (qwenCode) {
    case 'InvalidApiKey':
    case 'Unauthorized':
      return 'authentication_error';
    case 'InvalidRequest':
    case 'BadRequest':
      return 'invalid_request_error';
    case 'RateLimitExceeded':
    case 'TooManyRequests':
      return 'rate_limit_error';
    case 'RequestTimeout':
      return 'timeout_error';
    case 'InternalError':
    case 'ServiceUnavailable':
    default:
      return 'api_error';
  }
}

/**
 * Map Gemini-specific error codes to Anthropic error types (future support)
 */
function mapGeminiErrorType(geminiCode: string): AnthropicError['error']['type'] {
  switch (geminiCode) {
    case 'PERMISSION_DENIED':
    case 'UNAUTHENTICATED':
      return 'authentication_error';
    case 'INVALID_ARGUMENT':
    case 'FAILED_PRECONDITION':
      return 'invalid_request_error';
    case 'RESOURCE_EXHAUSTED':
      return 'rate_limit_error';
    case 'DEADLINE_EXCEEDED':
      return 'timeout_error';
    case 'UNAVAILABLE':
    case 'INTERNAL':
    default:
      return 'api_error';
  }
}

/**
 * Map OpenAI error types to Anthropic error types
 */
function mapOpenAIErrorType(openaiType: string): AnthropicError['error']['type'] {
  switch (openaiType) {
    case 'invalid_request_error':
      return 'invalid_request_error';
    case 'authentication_error':
      return 'authentication_error';
    case 'rate_limit_error':
      return 'rate_limit_error';
    case 'api_error':
    case 'server_error':
      return 'api_error';
    default:
      return 'api_error';
  }
}

/**
 * Get HTTP status code for error type
 */
function getErrorStatusCode(errorType: string): number {
  switch (errorType) {
    case 'invalid_request_error':
      return 400;
    case 'authentication_error':
      return 401;
    case 'rate_limit_error':
      return 429;
    case 'not_supported_error':
      return 400;
    case 'timeout_error':
      return 408;
    case 'network_error':
      return 502;
    case 'api_error':
    default:
      return 500;
  }
}

/**
 * Enhanced error logger middleware with provider context
 * Logs errors for monitoring and debugging
 */
export function errorLogger(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    provider: req.provider?.name,
    protocol: req.provider?.protocol,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
      code: error.code,
      statusCode: error.statusCode,
      provider: error.provider
    }
  };

  logger.error('Application Error', errorInfo);
  
  next(error);
}