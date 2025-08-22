/**
 * Rate Limiting Middleware
 * Implements rate limiting for API endpoints
 */

import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import type { RateLimitConfig, AnthropicError } from '@/types/index.js';

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.maxRequests,
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    skipFailedRequests: config.skipFailedRequests || false,
    
    // Custom key generator to support API key-based limiting
    keyGenerator: (req: Request): string => {
      const apiKey = req.headers['x-api-key'] as string;
      if (apiKey) {
        return `api_key:${apiKey}`;
      }
      return req.ip || 'unknown';
    },

    // Custom rate limit handler
    handler: (req: Request, res: Response) => {
      const anthropicError: AnthropicError = {
        type: 'error',
        error: {
          type: 'rate_limit_error',
          message: 'Too many requests. Please slow down and try again later.'
        }
      };

      res.status(429).json(anthropicError);
    },

    // Add rate limit headers
    standardHeaders: true,
    legacyHeaders: false,

    // Custom header names for consistency
    headers: {
      remaining: 'X-RateLimit-Remaining',
      reset: 'X-RateLimit-Reset',
      total: 'X-RateLimit-Limit'
    }
  });
}

/**
 * Create development rate limiter with higher limits
 */
export function createDevRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // Very high limit for development
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    
    keyGenerator: (req: Request): string => {
      return req.ip || 'dev';
    },

    handler: (req: Request, res: Response) => {
      const anthropicError: AnthropicError = {
        type: 'error',
        error: {
          type: 'rate_limit_error',
          message: 'Development rate limit exceeded'
        }
      };

      res.status(429).json(anthropicError);
    }
  });
}

/**
 * Create production rate limiter with strict limits
 */
export function createProdRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each API key to 100 requests per windowMs
    skipSuccessfulRequests: false,
    skipFailedRequests: true, // Don't count failed requests against limit
    
    keyGenerator: (req: Request): string => {
      const apiKey = req.headers['x-api-key'] as string;
      if (apiKey) {
        return `prod_api_key:${apiKey}`;
      }
      return `prod_ip:${req.ip || 'unknown'}`;
    },

    handler: (req: Request, res: Response) => {
      const anthropicError: AnthropicError = {
        type: 'error',
        error: {
          type: 'rate_limit_error',
          message: 'Rate limit exceeded. Please wait before making more requests.'
        }
      };

      res.status(429).json(anthropicError);
    },

    standardHeaders: true,
    legacyHeaders: false
  });
}

/**
 * Create tier-based rate limiter
 * Different limits based on API key tier
 */
export function createTieredRateLimiter() {
  const tierLimits = {
    free: { windowMs: 60 * 60 * 1000, max: 20 }, // 20 requests per hour
    basic: { windowMs: 60 * 60 * 1000, max: 100 }, // 100 requests per hour
    premium: { windowMs: 60 * 60 * 1000, max: 1000 }, // 1000 requests per hour
    enterprise: { windowMs: 60 * 60 * 1000, max: 10000 } // 10000 requests per hour
  };

  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour default
    max: (req: Request) => {
      // In a real implementation, you'd look up the tier from the API key
      const apiKey = req.headers['x-api-key'] as string;
      const tier = getUserTier(apiKey); // This would be a database lookup
      return tierLimits[tier as keyof typeof tierLimits]?.max || tierLimits.free.max;
    },

    keyGenerator: (req: Request): string => {
      const apiKey = req.headers['x-api-key'] as string;
      if (apiKey) {
        return `tiered_api_key:${apiKey}`;
      }
      return `tiered_ip:${req.ip || 'unknown'}`;
    },

    handler: (req: Request, res: Response) => {
      const anthropicError: AnthropicError = {
        type: 'error',
        error: {
          type: 'rate_limit_error',
          message: 'Rate limit exceeded for your subscription tier. Consider upgrading for higher limits.'
        }
      };

      res.status(429).json(anthropicError);
    },

    standardHeaders: true,
    legacyHeaders: false
  });
}

/**
 * Health check rate limiter (more permissive)
 */
export function createHealthCheckRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute for health checks
    
    keyGenerator: (req: Request): string => {
      return `health:${req.ip || 'unknown'}`;
    },

    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too many health check requests'
      });
    },

    standardHeaders: true,
    legacyHeaders: false
  });
}

/**
 * Mock function to get user tier
 * In production, this would query a database or cache
 */
function getUserTier(apiKey: string): string {
  // This is a mock implementation
  // In practice, you'd look up the API key in your database
  
  if (!apiKey) return 'free';
  
  // Simple mock logic based on API key format
  if (apiKey.includes('enterprise')) return 'enterprise';
  if (apiKey.includes('premium')) return 'premium';
  if (apiKey.includes('basic')) return 'basic';
  
  return 'free';
}

/**
 * Rate limiting metrics collector
 */
export class RateLimitMetrics {
  private limitedRequests = 0;
  private totalRequests = 0;
  private limitsByKey = new Map<string, number>();

  incrementTotal(): void {
    this.totalRequests++;
  }

  incrementLimited(key: string): void {
    this.limitedRequests++;
    this.limitsByKey.set(key, (this.limitsByKey.get(key) || 0) + 1);
  }

  getMetrics() {
    return {
      totalRequests: this.totalRequests,
      limitedRequests: this.limitedRequests,
      limitRate: this.totalRequests > 0 ? (this.limitedRequests / this.totalRequests) * 100 : 0,
      topLimitedKeys: Array.from(this.limitsByKey.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
    };
  }

  reset(): void {
    this.limitedRequests = 0;
    this.totalRequests = 0;
    this.limitsByKey.clear();
  }
}