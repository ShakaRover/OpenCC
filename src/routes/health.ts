/**
 * Health Check Route Handler
 * Handles /health endpoint for service monitoring
 */

import { Router, Request, Response } from 'express';
import type { HealthCheckResult } from '@/types/index.js';
import { ConversionService } from '@/services/index.js';
import { configManager } from '@/config/index.js';

export function createHealthRouter(conversionService: ConversionService): Router {
  const router = Router();

  /**
   * GET /health
   * Basic health check endpoint
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const healthStatus = await conversionService.getHealthStatus();
      const config = configManager.getConfig();
      const envInfo = configManager.getEnvironmentInfo();

      const memoryUsage = process.memoryUsage();
      const healthResult: HealthCheckResult = {
        status: healthStatus.status,
        timestamp: Date.now(),
        version: '1.0.0',
        uptime: process.uptime(),
        services: {
          openai: healthStatus.openai
        },
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
        }
      };

      const statusCode = healthResult.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(healthResult);

    } catch (error) {
      console.error('Health check error:', error);
      
      const unhealthyResult: HealthCheckResult = {
        status: 'unhealthy',
        timestamp: Date.now(),
        version: '1.0.0',
        uptime: process.uptime(),
        services: {
          openai: {
            status: 'down'
          }
        },
        memory: {
          used: 0,
          total: 0,
          percentage: 0
        }
      };

      res.status(503).json(unhealthyResult);
    }
  });

  /**
   * GET /health/detailed
   * Detailed health check with metrics
   */
  router.get('/detailed', async (req: Request, res: Response) => {
    try {
      const healthStatus = await conversionService.getHealthStatus();
      const metrics = conversionService.getMetrics();
      const config = configManager.getConfig();
      const envInfo = configManager.getEnvironmentInfo();

      const memoryUsage = process.memoryUsage();
      const detailedHealth = {
        status: healthStatus.status,
        timestamp: Date.now(),
        version: '1.0.0',
        uptime: process.uptime(),
        environment: {
          nodeVersion: envInfo.nodeVersion,
          platform: envInfo.platform,
          nodeEnv: config.server.nodeEnv
        },
        services: {
          openai: healthStatus.openai
        },
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
          rss: memoryUsage.rss,
          external: memoryUsage.external
        },
        metrics: {
          activeRequests: healthStatus.metrics.activeRequests,
          totalRequests: healthStatus.metrics.totalRequests,
          recentRequests: metrics.slice(-10) // Last 10 requests
        },
        configuration: {
          features: config.features,
          supportedModels: Object.keys(configManager.getModelMapping())
        }
      };

      const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(detailedHealth);

    } catch (error) {
      console.error('Detailed health check error:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /health/metrics
   * Request metrics endpoint
   */
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const metrics = conversionService.getMetrics();
      
      // Calculate summary statistics
      const totalRequests = metrics.length;
      const successfulRequests = metrics.filter(m => m.status === 'success').length;
      const errorRequests = metrics.filter(m => m.status === 'error').length;
      const pendingRequests = metrics.filter(m => m.status === 'pending').length;
      
      const completedRequests = metrics.filter(m => m.duration !== undefined);
      const avgDuration = completedRequests.length > 0 
        ? completedRequests.reduce((sum, m) => sum + (m.duration || 0), 0) / completedRequests.length
        : 0;

      const totalTokens = metrics.reduce((sum, m) => 
        sum + (m.inputTokens || 0) + (m.outputTokens || 0), 0);

      const metricsResponse = {
        summary: {
          totalRequests,
          successfulRequests,
          errorRequests,
          pendingRequests,
          successRate: totalRequests > 0 ? (successfulRequests / totalRequests * 100).toFixed(2) : '0',
          averageDuration: Math.round(avgDuration),
          totalTokens
        },
        requests: metrics
      };

      res.json(metricsResponse);

    } catch (error) {
      console.error('Metrics endpoint error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch metrics'
      });
    }
  });

  return router;
}