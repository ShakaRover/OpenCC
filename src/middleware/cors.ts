/**
 * CORS Middleware
 * Handles Cross-Origin Resource Sharing for the API
 */

import cors from 'cors';
import type { CorsOptions } from 'cors';
import type { ServerConfig } from '@/types/index.js';

/**
 * Create CORS middleware with configuration
 */
export function createCorsMiddleware(config: ServerConfig) {
  const corsOptions: CorsOptions = {
    origin: config.corsOrigin,
    credentials: config.corsCredentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'anthropic-version',
      'anthropic-beta',
      'User-Agent',
      'Accept',
      'Cache-Control'
    ],
    exposedHeaders: [
      'Content-Type',
      'Content-Length',
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
  };

  return cors(corsOptions);
}

/**
 * Development CORS middleware with permissive settings
 */
export function createDevCorsMiddleware() {
  const corsOptions: CorsOptions = {
    origin: true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
    allowedHeaders: ['*'],
    exposedHeaders: ['*'],
    maxAge: 86400,
    optionsSuccessStatus: 200
  };

  return cors(corsOptions);
}

/**
 * Production CORS middleware with strict settings
 */
export function createProdCorsMiddleware(allowedOrigins: string | string[]) {
  const corsOptions: CorsOptions = {
    origin: allowedOrigins,
    credentials: false, // Disable credentials for production security
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'anthropic-version',
      'User-Agent',
      'Accept'
    ],
    exposedHeaders: [
      'Content-Type',
      'Content-Length',
      'X-Request-ID'
    ],
    maxAge: 3600, // 1 hour for production
    optionsSuccessStatus: 200
  };

  return cors(corsOptions);
}