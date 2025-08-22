/**
 * Middleware modules export barrel
 */

export { 
  anthropicAuthMiddleware, 
  optionalAuthMiddleware,
  ApiKeyRateLimiter,
  extractUserInfo
} from './auth.js';

export { 
  createCorsMiddleware,
  createDevCorsMiddleware,
  createProdCorsMiddleware
} from './cors.js';

export { 
  errorHandler,
  asyncHandler,
  notFoundHandler,
  validationErrorHandler,
  timeoutErrorHandler,
  errorLogger
} from './error-handler.js';

export { 
  createLogger,
  requestLogger,
  performanceLogger,
  errorTracker,
  MetricsCollector
} from './logging.js';

export { 
  createRateLimiter,
  createDevRateLimiter,
  createProdRateLimiter,
  createTieredRateLimiter,
  createHealthCheckRateLimiter,
  RateLimitMetrics
} from './rate-limit.js';