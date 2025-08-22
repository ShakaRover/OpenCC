/**
 * Express Application Setup
 * Configures and creates the Express app with all middleware and routes
 */

import express from 'express';
import helmet from 'helmet';
import type { Application } from 'express';

// Import services and middleware
import { configManager } from '@/config/index.js';
import { OpenAIService, ConversionService } from '@/services/index.js';
import { createMessagesRouter, createModelsRouter, createHealthRouter } from '@/routes/index.js';

import {
  createCorsMiddleware,
  createDevCorsMiddleware,
  createProdCorsMiddleware,
  anthropicAuthMiddleware,
  optionalAuthMiddleware,
  createRateLimiter,
  createDevRateLimiter,
  createProdRateLimiter,
  createHealthCheckRateLimiter,
  createLogger,
  requestLogger,
  performanceLogger,
  errorLogger,
  errorHandler,
  notFoundHandler,
  validationErrorHandler,
  timeoutErrorHandler,
  MetricsCollector
} from '@/middleware/index.js';

/**
 * Create and configure Express application
 */
export async function createApp(): Promise<Application> {
  const app = express();
  const config = configManager.getConfig();
  
  // Load model mapping
  await configManager.loadModelMapping();
  
  // Create services
  const openAIService = new OpenAIService(config.openai);
  const conversionService = new ConversionService(
    openAIService,
    configManager.getModelMapping()
  );

  // Create logger
  const logger = createLogger(config.logging);
  const metricsCollector = new MetricsCollector();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for API
    crossOriginEmbedderPolicy: false
  }));

  // CORS middleware
  if (config.server.nodeEnv === 'development') {
    app.use(createDevCorsMiddleware());
  } else {
    app.use(createCorsMiddleware(config.server));
  }

  // Body parsing middleware
  app.use(express.json({ 
    limit: config.maxRequestSize,
    type: 'application/json'
  }));
  
  app.use(express.urlencoded({ 
    extended: true, 
    limit: config.maxRequestSize 
  }));

  // Trust proxy if behind reverse proxy
  if (config.server.nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }

  // Logging middleware
  app.use(requestLogger(logger, config.logging.verboseLogging));
  app.use(performanceLogger(logger));
  app.use(metricsCollector.getMiddleware());

  // Rate limiting
  if (config.server.nodeEnv === 'development') {
    app.use('/v1', createDevRateLimiter());
  } else {
    app.use('/v1', createRateLimiter(config.rateLimit));
  }

  // Health check rate limiting (more permissive)
  app.use('/health', createHealthCheckRateLimiter());

  // Error tracking
  app.use(errorLogger(logger));

  // API routes with authentication
  const v1Router = express.Router();
  
  // Messages endpoint (requires authentication)
  v1Router.use('/messages', anthropicAuthMiddleware);
  v1Router.use('/messages', createMessagesRouter(conversionService));
  
  // Models endpoint (requires authentication)
  v1Router.use('/models', anthropicAuthMiddleware);
  v1Router.use('/models', createModelsRouter(conversionService));
  
  app.use('/v1', v1Router);

  // Health check endpoint (no authentication required)
  app.use('/health', createHealthRouter(conversionService));

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      name: 'OpenClaude Protocol Converter',
      version: '1.0.0',
      description: 'Anthropic Claude API to OpenAI API protocol converter',
      status: 'online',
      endpoints: {
        messages: '/v1/messages',
        models: '/v1/models',
        health: '/health'
      },
      documentation: 'https://github.com/openclaude/openclaude'
    });
  });

  // Error handling middleware (must be last)
  app.use(validationErrorHandler);
  app.use(timeoutErrorHandler);
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Store references for cleanup
  app.locals.services = {
    openAIService,
    conversionService,
    logger,
    metricsCollector
  };

  return app;
}

/**
 * Graceful shutdown handler
 */
export function setupGracefulShutdown(app: Application): void {
  const gracefulShutdown = (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    
    const services = app.locals.services;
    
    // Clean up metrics
    if (services?.metricsCollector) {
      console.log('Cleaning up metrics...');
      // Could save metrics to persistent storage here
    }
    
    // Clean up conversion service
    if (services?.conversionService) {
      console.log('Cleaning up conversion service...');
      services.conversionService.clearOldMetrics(0); // Clear all metrics
    }
    
    console.log('Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

/**
 * Start periodic cleanup tasks
 */
export function startCleanupTasks(app: Application): void {
  const services = app.locals.services;
  
  if (services?.conversionService) {
    // Clean up old metrics every hour
    setInterval(() => {
      services.conversionService.clearOldMetrics();
    }, 60 * 60 * 1000); // 1 hour
  }
}