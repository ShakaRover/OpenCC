import express, { Request, Response } from 'express';
import { logger, generateRequestId, logRequestStart, logRequestEnd, logConvertedRequest, logOriginalResponse, logConvertedResponse } from '@/utils/helpers';
import { providerMiddleware } from '@/middleware/provider';
import { anthropicToOpenAIConverter } from '@/converters/anthropic-to-openai';
import { openaiToAnthropicResponseConverter } from '@/converters/openai-to-anthropic';
import { streamProcessor } from '@/processors';
import type { ConversionContext } from '@/types';

const router = express.Router();

// 中间件：生成请求ID
router.use((req: Request, res: Response, next) => {
  req.requestId = generateRequestId();
  next();
});

// 中间件：可选认证（不验证ANTHROPIC_AUTH_TOKEN）
router.use(providerMiddleware.optionalAuth);

// 中间件：初始化提供商
router.use(providerMiddleware.initializeProvider.bind(providerMiddleware));

// 中间件：确保提供商已认证
router.use(providerMiddleware.ensureAuthenticated.bind(providerMiddleware));

// POST /v1/messages - 主要的消息处理端点
router.post('/', async (req: Request, res: Response) => {
  const requestId = req.requestId!;
  const startTime = Date.now();
  
  try {
    // 检查 beta 查询参数
    const isBeta = req.query.beta === 'true';
    if (isBeta) {
      logger.debug('Beta feature requested', {
        requestId,
        query: req.query,
        userAgent: req.get('User-Agent')
      });
    }
    
    // 记录请求开始（原始 Anthropic 请求）
    logRequestStart(requestId, 'POST', '/v1/messages', req.body.model, req.body);
    
    // 验证请求格式
    const validation = anthropicToOpenAIConverter.validateRequest(req.body);
    if (!validation.isValid) {
      logger.warn('Invalid request format', {
        requestId,
        errors: validation.errors
      });
      
      return res.status(400).json({
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message: `Invalid request: ${validation.errors.join(', ')}`
        }
      });
    }
    
    // 保存原始模型信息
    req.originalModel = req.body.model;
    
    // 确保提供商可用
    if (!req.provider) {
      throw new Error('API provider not initialized');
    }
    
    // 转换Anthropic请求到OpenAI格式
    const openaiRequest = anthropicToOpenAIConverter.convertRequest(req.body, requestId);
    
    // 记录转换后的请求（重构原消息）
    logConvertedRequest(requestId, openaiRequest);
    
    logger.debug('Sending request to API provider', {
      requestId,
      provider: req.provider.name,
      protocol: req.provider.protocol,
      model: openaiRequest.model,
      messageCount: openaiRequest.messages.length,
      stream: openaiRequest.stream
    });
    
    // 发送请求到API提供商
    const providerResponse = openaiRequest.stream 
      ? await req.provider.sendStreamRequest(openaiRequest, { requestId, timestamp: Date.now() })
      : await req.provider.sendRequest(openaiRequest, { requestId, timestamp: Date.now() });
    
    if (!providerResponse.ok) {
      const errorText = await providerResponse.text();
      logger.error('API provider request failed', {
        requestId,
        provider: req.provider.name,
        status: providerResponse.status,
        statusText: providerResponse.statusText,
        error: errorText
      });
      
      return res.status(providerResponse.status).json({
        type: 'error',
        error: {
          type: 'api_error',
          message: `API provider error: ${providerResponse.status} ${providerResponse.statusText}`
        }
      });
    }
    
    // 处理流式响应
    if (openaiRequest.stream) {
      return streamProcessor.processStreamResponse(providerResponse, req, res, requestId, startTime);
    }
    
    // 处理普通响应
    const providerResponseData = await providerResponse.json();
    
    // 记录原始响应（返回原消息）
    logOriginalResponse(requestId, providerResponseData);
    
    logger.debug('Received response from API provider', {
      requestId,
      provider: req.provider.name,
      responseId: providerResponseData.id,
      model: providerResponseData.model,
      usage: providerResponseData.usage
    });
    
    // 转换OpenAI响应到Anthropic格式
    const anthropicResponse = openaiToAnthropicResponseConverter.convertResponse(
      providerResponseData,
      req.originalModel!,
      requestId
    );
    
    // 记录转换后的响应（返回重构消息）
    logConvertedResponse(requestId, anthropicResponse);
    
    // 记录请求完成
    const duration = Date.now() - startTime;
    logRequestEnd(requestId, 200, duration, {
      input: anthropicResponse.usage.input_tokens,
      output: anthropicResponse.usage.output_tokens
    });
    
    // 返回转换后的响应
    res.json(anthropicResponse);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error processing messages request', {
      requestId,
      duration,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    logRequestEnd(requestId, 500, duration);
    
    res.status(500).json({
      type: 'error',
      error: {
        type: 'internal_server_error',
        message: 'An internal error occurred while processing your request'
      }
    });
  }
});

export default router;