/**
 * Middleware modules export barrel
 */

export { 
  anthropicAuthMiddleware, 
  optionalAuthMiddleware,
  ApiKeyRateLimiter,
  extractUserInfo
} from './auth';

export { 
  createCorsMiddleware,
  createDevCorsMiddleware,
  createProdCorsMiddleware
} from './cors';

export { 
  errorHandler,
  asyncHandler,
  notFoundHandler,
  validationErrorHandler,
  timeoutErrorHandler,
  errorLogger
} from './error-handler';

export { 
  createLogger,
  requestLogger,
  performanceLogger,
  errorTracker,
  MetricsCollector
} from './logging';

export { 
  createRateLimiter,
  createDevRateLimiter,
  createProdRateLimiter,
  createTieredRateLimiter,
  createHealthCheckRateLimiter,
  RateLimitMetrics
} from './rate-limit';