/**
 * Provider Middleware
 * Universal middleware for provider initialization and authentication
 * Replaces the OAuth-specific middleware with a more flexible approach
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/helpers';
import { configManager } from '@/config';
import { providerFactory } from '@/providers';
import type { APIProvider } from '@/providers';

// Extend Express Request interface to include provider information
declare global {
  namespace Express {
    interface Request {
      provider?: APIProvider;
      requestId?: string;
      authenticated?: boolean;
      authToken?: string;
      originalModel?: string;
      convertedBody?: any;
      // Keep backward compatibility with existing OAuth properties
      qwenAccessToken?: string;
      qwenBaseUrl?: string;
      oauthStatus?: {
        hasCredentials: boolean;
        isExpired: boolean;
        expiryDate?: string;
        resourceUrl?: string;
        error?: string;
      };
    }
  }
}

/**
 * Provider Middleware Class
 * Handles provider initialization, authentication, and request preparation
 */
export class ProviderMiddleware {
  private providerCache: Map<string, APIProvider> = new Map();
  
  /**
   * Initialize provider based on current configuration mode
   */
  async initializeProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = req.requestId || 'unknown';
    
    try {
      logger.debug('Initializing provider for request', { requestId });
      
      // Get current configuration mode
      const config = configManager.getConfig();
      const configMode = configManager.getConfigMode();
      
      logger.debug('Provider initialization started', {
        requestId,
        configMode,
        timestamp: new Date().toISOString()
      });
      
      // Check if we have a cached provider for this mode
      const cacheKey = configMode;
      let provider = this.providerCache.get(cacheKey);
      
      if (provider) {
        // Test cached provider health
        const healthStatus = await provider.testConnection();
        if (healthStatus.isHealthy) {
          req.provider = provider;
          logger.debug('Using cached provider', {
            requestId,
            provider: provider.name,
            protocol: provider.protocol,
            responseTime: healthStatus.responseTime
          });
          next();
          return;
        } else {
          logger.warn('Cached provider is unhealthy, creating new instance', {
            requestId,
            provider: provider.name,
            error: healthStatus.error
          });
          this.providerCache.delete(cacheKey);
        }
      }
      
      // Create new provider instance
      provider = await providerFactory.createProvider(configMode);
      
      // Cache the provider
      this.providerCache.set(cacheKey, provider);
      
      // Attach provider to request
      req.provider = provider;
      
      logger.info('Provider initialized successfully', {
        requestId,
        provider: provider.name,
        protocol: provider.protocol,
        version: provider.version,
        configMode
      });
      
      next();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Provider initialization failed', {
        requestId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      res.status(500).json({
        type: 'error',
        error: {
          type: 'provider_initialization_error',
          message: `Failed to initialize API provider: ${errorMessage}`
        }
      });
    }
  }
  
  /**
   * Ensure provider is authenticated and ready
   */
  async ensureAuthenticated(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = req.requestId || 'unknown';
    
    try {
      if (!req.provider) {
        throw new Error('Provider not initialized. Ensure initializeProvider middleware is called first.');
      }
      
      logger.debug('Ensuring provider authentication', {
        requestId,
        provider: req.provider.name
      });
      
      // Test provider authentication
      const authHeaders = await req.provider.getAuthHeaders();
      
      if (!authHeaders || Object.keys(authHeaders).length === 0) {
        throw new Error('Provider authentication failed - no auth headers available');
      }
      
      // For backward compatibility, set OAuth-style properties
      if (req.provider.name === 'qwen') {
        const bearerToken = authHeaders['Authorization']?.replace('Bearer ', '');
        req.qwenAccessToken = bearerToken;
        req.qwenBaseUrl = req.provider.baseUrl;
      }
      
      // Mark as authenticated
      req.authenticated = true;
      req.authToken = authHeaders['Authorization'] || 'provider-authenticated';
      
      logger.debug('Provider authentication successful', {
        requestId,
        provider: req.provider.name,
        hasAuthHeaders: Object.keys(authHeaders).length > 0
      });
      
      next();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Provider authentication failed', {
        requestId,
        provider: req.provider?.name,
        error: errorMessage
      });
      
      res.status(401).json({
        type: 'error',
        error: {
          type: 'authentication_error',
          message: `Provider authentication failed: ${errorMessage}`
        }
      });
    }
  }
  
  /**
   * Optional authentication middleware (bypass for testing)
   */
  optionalAuth(req: Request, res: Response, next: NextFunction): void {
    const requestId = req.requestId || 'unknown';
    
    // Get auth header for logging (but don't validate)
    const authHeader = req.headers.authorization;
    const authToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    
    // Mark as authenticated without actual validation
    req.authenticated = true;
    req.authToken = authToken || 'optional-auth-bypass';
    
    logger.debug('Optional authentication bypass', {
      requestId,
      hasAuthHeader: !!authHeader,
      authTokenPrefix: authToken ? authToken.substring(0, 10) + '...' : 'none'
    });
    
    next();
  }
  
  /**
   * Health check middleware - provides provider status
   */
  async checkProviderHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.provider) {
        // If no provider is available, try to initialize one
        await this.initializeProvider(req, res, next);
        return;
      }
      
      const healthStatus = await req.provider.testConnection();
      
      // Attach health status to request (for health endpoints)
      req.providerHealth = healthStatus;
      
      // For backward compatibility with OAuth status
      if (req.provider.name === 'qwen') {
        req.oauthStatus = {
          hasCredentials: healthStatus.isHealthy,
          isExpired: !healthStatus.isHealthy,
          error: healthStatus.error
        };
      }
      
      next();
      
    } catch (error) {
      logger.error('Provider health check failed', {
        requestId: req.requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Set unhealthy status
      req.providerHealth = {
        isHealthy: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: Date.now()
      };
      
      next();
    }
  }
  
  /**
   * Clear provider cache
   */
  clearCache(): void {
    logger.info('Clearing provider middleware cache');
    this.providerCache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; providers: string[] } {
    return {
      size: this.providerCache.size,
      providers: Array.from(this.providerCache.values()).map(p => p.name)
    };
  }
}

// Extend Express Request interface for provider health
declare global {
  namespace Express {
    interface Request {
      providerHealth?: {
        isHealthy: boolean;
        responseTime: number;
        error?: string;
        lastChecked: number;
      };
    }
  }
}

// Create singleton instance
export const providerMiddleware = new ProviderMiddleware();