/**
 * Error Handling Middleware
 * Handles and formats errors consistently across the application
 */

import { Request, Response, NextFunction } from 'express';
import type { AnthropicError, StandardError } from '../types/index.js';

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

  console.error('Error handler caught:', {
    error: error.message || error,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Convert error to Anthropic format
  const anthropicError = convertToAnthropicError(error);
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
 */
function convertToAnthropicError(error: any): AnthropicError {
  // Already an Anthropic error
  if (error.type === 'error' && error.error) {
    return error;
  }

  // OpenAI API error
  if (error.error && error.error.message) {
    return {
      type: 'error',
      error: {
        type: mapOpenAIErrorType(error.error.type),
        message: error.error.message
      }
    };
  }

  // Axios error
  if (error.response && error.response.data) {
    return {
      type: 'error',
      error: {
        type: 'api_error',
        message: error.response.data.message || 'External API error'
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
  if (error.status === 429) {
    return {
      type: 'error',
      error: {
        type: 'rate_limit_error',
        message: 'Rate limit exceeded. Please slow down your requests.'
      }
    };
  }

  // Authentication error
  if (error.status === 401) {
    return {
      type: 'error',
      error: {
        type: 'authentication_error',
        message: 'Authentication failed. Please check your API key.'
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
 * Error logger middleware
 * Logs errors for monitoring and debugging
 */
export function errorLogger(
  logger: any
) {
  return (error: any, req: Request, res: Response, next: NextFunction): void => {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      error: {
        message: error.message,
        stack: error.stack,
        type: error.constructor.name
      }
    };

    logger.error('Application Error:', JSON.stringify(errorInfo, null, 2));
    
    next(error);
  };
}