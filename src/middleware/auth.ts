/**
 * Authentication Middleware
 * Handles API key validation for Anthropic API compatibility
 */

import { Request, Response, NextFunction } from 'express';
import type { AnthropicError } from '../types/index.js';

interface AuthenticatedRequest extends Request {
  apiKey?: string;
}

/**
 * Anthropic API Key Authentication Middleware
 * Validates x-api-key header for Anthropic compatibility
 */
export function anthropicAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    // Extract API key from headers
    const apiKey = req.headers['x-api-key'] as string || 
                   req.headers['authorization']?.replace(/^Bearer\s+/, '') as string;

    if (!apiKey) {
      const error: AnthropicError = {
        type: 'error',
        error: {
          type: 'authentication_error',
          message: 'Missing API key. Please provide a valid API key in the x-api-key header.'
        }
      };

      res.status(401).json(error);
      return;
    }

    // Basic API key format validation
    if (!isValidApiKeyFormat(apiKey)) {
      const error: AnthropicError = {
        type: 'error',
        error: {
          type: 'authentication_error',
          message: 'Invalid API key format. Please provide a valid API key.'
        }
      };

      res.status(401).json(error);
      return;
    }

    // Store API key in request for potential future use
    req.apiKey = apiKey;

    next();

  } catch (error) {
    console.error('Authentication middleware error:', error);
    
    const authError: AnthropicError = {
      type: 'error',
      error: {
        type: 'authentication_error',
        message: 'Authentication failed'
      }
    };

    res.status(401).json(authError);
  }
}

/**
 * Optional Authentication Middleware
 * For endpoints that don't require authentication (like health checks)
 */
export function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const apiKey = req.headers['x-api-key'] as string || 
                   req.headers['authorization']?.replace(/^Bearer\s+/, '') as string;

    if (apiKey && isValidApiKeyFormat(apiKey)) {
      req.apiKey = apiKey;
    }

    next();

  } catch (error) {
    // For optional auth, we continue even if there's an error
    next();
  }
}

/**
 * Validate API key format
 * Basic format validation for API keys
 */
function isValidApiKeyFormat(apiKey: string): boolean {
  // Check if it's a non-empty string with reasonable length
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  // Basic length check (most API keys are at least 20 characters)
  if (apiKey.length < 10) {
    return false;
  }

  // Check for obviously invalid patterns
  if (/^[0]+$/.test(apiKey) || /^[a]+$/.test(apiKey)) {
    return false;
  }

  return true;
}

/**
 * Extract user identification from API key
 * This is a placeholder - in real implementation, you might look up user info
 */
export function extractUserInfo(apiKey: string): { userId?: string; tier?: string } {
  // This is a simplified implementation
  // In practice, you'd validate against a database or external service
  
  return {
    userId: `user_${apiKey.substring(0, 8)}`,
    tier: 'standard'
  };
}

/**
 * Rate limiting by API key
 * Track usage per API key for rate limiting
 */
export class ApiKeyRateLimiter {
  private usage: Map<string, { count: number; windowStart: number }> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 60) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * Check if API key has exceeded rate limit
   */
  isRateLimited(apiKey: string): boolean {
    const now = Date.now();
    const usage = this.usage.get(apiKey);

    if (!usage) {
      this.usage.set(apiKey, { count: 1, windowStart: now });
      return false;
    }

    // Reset window if expired
    if (now - usage.windowStart >= this.windowMs) {
      usage.count = 1;
      usage.windowStart = now;
      return false;
    }

    // Check if limit exceeded
    if (usage.count >= this.maxRequests) {
      return true;
    }

    // Increment count
    usage.count++;
    return false;
  }

  /**
   * Get remaining requests for API key
   */
  getRemainingRequests(apiKey: string): number {
    const usage = this.usage.get(apiKey);
    if (!usage) return this.maxRequests;

    const now = Date.now();
    if (now - usage.windowStart >= this.windowMs) {
      return this.maxRequests;
    }

    return Math.max(0, this.maxRequests - usage.count);
  }

  /**
   * Clean up old entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [apiKey, usage] of this.usage.entries()) {
      if (now - usage.windowStart >= this.windowMs * 2) {
        this.usage.delete(apiKey);
      }
    }
  }
}