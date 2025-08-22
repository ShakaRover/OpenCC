/**
 * Request Logging Middleware
 * Handles request/response logging and metrics collection
 */

import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import type { LoggingConfig } from '../types/index.js';
import { generateRequestId } from '../utils/helpers.js';

interface LoggedRequest extends Request {
  startTime?: number;
  requestId?: string;
}

/**
 * Create logger instance
 */
export function createLogger(config: LoggingConfig): winston.Logger {
  const formats = [
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ];

  if (config.format === 'json') {
    formats.push(winston.format.json());
  } else {
    formats.push(winston.format.simple());
  }

  return winston.createLogger({
    level: config.level,
    format: winston.format.combine(...formats),
    transports: [
      new winston.transports.Console({
        handleExceptions: true,
        handleRejections: true
      })
    ],
    exitOnError: false
  });
}

/**
 * Request logging middleware
 */
export function requestLogger(logger: winston.Logger, verboseLogging: boolean = false) {
  return (req: LoggedRequest, res: Response, next: NextFunction): void => {
    req.startTime = Date.now();
    req.requestId = req.get('X-Request-ID') || generateRequestId();

    // Add request ID to response headers
    res.set('X-Request-ID', req.requestId);

    const logData: any = {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString()
    };

    if (verboseLogging) {
      logData.headers = req.headers;
      logData.query = req.query;
      // Don't log body for security reasons, but log if it exists
      logData.hasBody = !!req.body && Object.keys(req.body).length > 0;
    }

    logger.info('Request started', logData);

    // Override res.end to capture response
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any, cb?: any) {
      const duration = Date.now() - (req.startTime || Date.now());
      
      const responseLogData: any = {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        timestamp: new Date().toISOString()
      };

      if (verboseLogging) {
        responseLogData.responseHeaders = res.getHeaders();
        responseLogData.responseSize = res.get('Content-Length') || 'unknown';
      }

      // Log appropriate level based on status code
      if (res.statusCode >= 500) {
        logger.error('Request completed with server error', responseLogData);
      } else if (res.statusCode >= 400) {
        logger.warn('Request completed with client error', responseLogData);
      } else {
        logger.info('Request completed successfully', responseLogData);
      }

      return originalEnd.call(this, chunk, encoding, cb);
    };

    next();
  };
}

/**
 * Performance logging middleware
 * Logs slow requests and performance metrics
 */
export function performanceLogger(
  logger: winston.Logger,
  slowRequestThreshold: number = 5000
) {
  return (req: LoggedRequest, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      if (duration > slowRequestThreshold) {
        logger.warn('Slow request detected', {
          requestId: req.requestId || 'unknown',
          method: req.method,
          url: req.url,
          duration,
          statusCode: res.statusCode,
          timestamp: new Date().toISOString()
        });
      }
    });

    next();
  };
}

/**
 * Error tracking middleware
 * Tracks and logs application errors
 */
export function errorTracker(logger: winston.Logger) {
  return (error: any, req: LoggedRequest, res: Response, next: NextFunction): void => {
    const errorData = {
      requestId: req.requestId || 'unknown',
      method: req.method,
      url: req.url,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        status: error.status
      },
      timestamp: new Date().toISOString()
    };

    logger.error('Application error occurred', errorData);
    next(error);
  };
}

/**
 * Metrics collection middleware
 * Collects basic request metrics
 */
export class MetricsCollector {
  private requestCount = 0;
  private errorCount = 0;
  private totalDuration = 0;
  private statusCodes = new Map<number, number>();

  getMiddleware() {
    return (req: LoggedRequest, res: Response, next: NextFunction): void => {
      const startTime = Date.now();
      this.requestCount++;

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.totalDuration += duration;

        // Track status codes
        const statusCode = res.statusCode;
        this.statusCodes.set(statusCode, (this.statusCodes.get(statusCode) || 0) + 1);

        // Track errors
        if (statusCode >= 400) {
          this.errorCount++;
        }
      });

      next();
    };
  }

  getMetrics() {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      averageDuration: this.requestCount > 0 ? this.totalDuration / this.requestCount : 0,
      statusCodes: Object.fromEntries(this.statusCodes),
      errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0
    };
  }

  reset() {
    this.requestCount = 0;
    this.errorCount = 0;
    this.totalDuration = 0;
    this.statusCodes.clear();
  }
}