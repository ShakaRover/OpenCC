/**
 * Messages Route Handler
 * Handles /v1/messages endpoint for Anthropic API compatibility
 */

import { Router, Request, Response } from 'express';
import type { AnthropicRequest, AnthropicResponse, AnthropicError } from '@/types/index.js';
import { ConversionService } from '@/services/index.js';

export function createMessagesRouter(conversionService: ConversionService): Router {
  const router = Router();

  /**
   * POST /v1/messages
   * Main endpoint for chat completions in Anthropic format
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const anthropicRequest = req.body as AnthropicRequest;
      
      // Extract client information
      const userAgent = req.get('User-Agent');
      const ipAddress = req.ip || req.connection.remoteAddress;

      // Check if streaming is requested
      if (anthropicRequest.stream) {
        await handleStreamingRequest(anthropicRequest, conversionService, req, res);
      } else {
        await handleRegularRequest(anthropicRequest, conversionService, req, res);
      }

    } catch (error) {
      console.error('Messages route error:', error);
      
      const anthropicError: AnthropicError = {
        type: 'error',
        error: {
          type: 'api_error',
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      };

      res.status(500).json(anthropicError);
    }
  });

  return router;
}

/**
 * Handle regular (non-streaming) request
 */
async function handleRegularRequest(
  anthropicRequest: AnthropicRequest,
  conversionService: ConversionService,
  req: Request,
  res: Response
): Promise<void> {
  const userAgent = req.get('User-Agent');
  const ipAddress = req.ip || req.connection.remoteAddress;

  const result = await conversionService.processRequest(
    anthropicRequest,
    userAgent,
    ipAddress
  );

  if (result.success && result.data) {
    res.json(result.data);
  } else {
    const statusCode = getErrorStatusCode(result.error?.type);
    
    const anthropicError: AnthropicError = {
      type: 'error',
      error: {
        type: result.error?.type || 'api_error',
        message: result.error?.message || 'Unknown error occurred'
      }
    };

    res.status(statusCode).json(anthropicError);
  }
}

/**
 * Handle streaming request
 */
async function handleStreamingRequest(
  anthropicRequest: AnthropicRequest,
  conversionService: ConversionService,
  req: Request,
  res: Response
): Promise<void> {
  const userAgent = req.get('User-Agent');
  const ipAddress = req.ip || req.connection.remoteAddress;

  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  try {
    const result = await conversionService.processStreamingRequest(
      anthropicRequest,
      userAgent,
      ipAddress
    );

    if (result.success && result.data) {
      // Stream the response
      for await (const chunk of result.data) {
        res.write(chunk);
      }
      res.end();
    } else {
      // Send error in streaming format
      const anthropicError: AnthropicError = {
        type: 'error',
        error: {
          type: result.error?.type || 'api_error',
          message: result.error?.message || 'Unknown error occurred'
        }
      };

      res.write(`data: ${JSON.stringify(anthropicError)}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('Streaming error:', error);
    
    const anthropicError: AnthropicError = {
      type: 'error',
      error: {
        type: 'api_error',
        message: error instanceof Error ? error.message : 'Streaming error occurred'
      }
    };

    res.write(`data: ${JSON.stringify(anthropicError)}\n\n`);
    res.end();
  }
}

/**
 * Map error types to HTTP status codes
 */
function getErrorStatusCode(errorType?: string): number {
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
    case 'api_error':
    default:
      return 500;
  }
}