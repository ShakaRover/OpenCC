import express, { Request, Response } from 'express';
import { logger, generateRequestId, logRequestStart, logRequestEnd } from '../utils/helpers.js';
import { configManager } from '../config/index.js';
import { oauthMiddleware } from '../middleware/oauth.js';
import { anthropicToOpenAIConverter } from '../converters/anthropic-to-openai.js';
import { openaiToAnthropicResponseConverter } from '../converters/openai-to-anthropic-response.js';
import { OpenAIService } from '../services/openai-service.js';
import type { ConversionContext } from '../types/index.js';

const router = express.Router();

// 中间件：生成请求ID
router.use((req: Request, res: Response, next) => {
  req.requestId = generateRequestId();
  next();
});

// 中间件：可选认证（不验证ANTHROPIC_AUTH_TOKEN）
router.use(oauthMiddleware.optionalAuth);

// 中间件：确保有有效的Qwen OAuth Token
router.use(oauthMiddleware.ensureValidToken);

// POST /v1/messages - 主要的消息处理端点
router.post('/', async (req: Request, res: Response) => {
  const requestId = req.requestId!;
  const startTime = Date.now();
  
  try {
    // 记录请求开始
    logRequestStart(requestId, 'POST', '/v1/messages', req.body.model);
    
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
    
    // 转换Anthropic请求到OpenAI格式
    const openaiRequest = anthropicToOpenAIConverter.convertRequest(req.body, requestId);
    
    // 构建Qwen API请求
    const qwenApiUrl = `${req.qwenBaseUrl}/v1/chat/completions`;
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.qwenAccessToken}`
      },
      body: JSON.stringify(openaiRequest)
    };
    
    logger.debug('Sending request to Qwen API', {
      requestId,
      url: qwenApiUrl,
      model: openaiRequest.model,
      messageCount: openaiRequest.messages.length,
      stream: openaiRequest.stream
    });
    
    // 发送请求到Qwen API
    const qwenResponse = await fetch(qwenApiUrl, requestOptions);
    
    if (!qwenResponse.ok) {
      const errorText = await qwenResponse.text();
      logger.error('Qwen API request failed', {
        requestId,
        status: qwenResponse.status,
        statusText: qwenResponse.statusText,
        error: errorText
      });
      
      return res.status(qwenResponse.status).json({
        type: 'error',
        error: {
          type: 'api_error',
          message: `Qwen API error: ${qwenResponse.status} ${qwenResponse.statusText}`
        }
      });
    }
    
    // 处理流式响应
    if (openaiRequest.stream) {
      return handleStreamResponse(qwenResponse, req, res, requestId, startTime);
    }
    
    // 处理普通响应
    const qwenResponseData = await qwenResponse.json();
    
    logger.debug('Received response from Qwen API', {
      requestId,
      responseId: qwenResponseData.id,
      model: qwenResponseData.model,
      usage: qwenResponseData.usage
    });
    
    // 转换OpenAI响应到Anthropic格式
    const anthropicResponse = openaiToAnthropicResponseConverter.convertResponse(
      qwenResponseData,
      req.originalModel!,
      requestId
    );
    
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

/**
 * 处理流式响应
 */
async function handleStreamResponse(
  qwenResponse: globalThis.Response,
  req: Request,
  res: Response,
  requestId: string,
  startTime: number
): Promise<void> {
  try {
    logger.info('Starting stream response handling', { requestId });
    
    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no', // 禁用nginx缓冲
      'Transfer-Encoding': 'chunked'
    });
    
    // 发送初始连接确认
    res.write('event: connected\ndata: {"type": "ping"}\n\n');
    
    const reader = qwenResponse.body?.getReader();
    if (!reader) {
      throw new Error('No readable stream available');
    }
    
    const decoder = new TextDecoder();
    let isFirstChunk = true;
    let totalOutputTokens = 0;
    let buffer = '';
    
    // 设置客户端断开连接检测
    const checkConnection = () => {
      if (res.destroyed || res.writableEnded) {
        logger.info('Client disconnected during stream', { requestId });
        reader.cancel();
        return false;
      }
      return true;
    };
    
    try {
      while (true) {
        if (!checkConnection()) break;
        
        const { done, value } = await reader.read();
        
        if (done) {
          logger.info('Stream reading completed', { requestId, totalOutputTokens });
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // 按行处理缓冲区
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行
        
        for (const line of lines) {
          if (!checkConnection()) break;
          
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              res.write('data: [DONE]\n\n');
              logger.info('Stream completed with [DONE]', { requestId });
              continue;
            }
            
            if (!data) continue; // 跳过空数据
            
            try {
              const qwenChunk = JSON.parse(data);
              
              // 转换为Anthropic格式的流式块
              const anthropicChunks = openaiToAnthropicResponseConverter.convertStreamChunk(
                qwenChunk,
                req.originalModel!,
                requestId,
                isFirstChunk
              );
              
              // 发送转换后的块
              for (const anthropicChunk of anthropicChunks) {
                if (!checkConnection()) break;
                res.write(anthropicChunk);
              }
              
              // 统计token使用量
              if (qwenChunk.usage?.completion_tokens) {
                totalOutputTokens = qwenChunk.usage.completion_tokens;
              }
              
              isFirstChunk = false;
              
            } catch (parseError) {
              logger.warn('Failed to parse stream chunk', {
                requestId,
                chunk: data.substring(0, 200), // 限制日志长度
                error: parseError instanceof Error ? parseError.message : String(parseError)
              });
            }
          }
        }
      }
      
      // 处理剩余的缓冲区数据
      if (buffer.trim() && checkConnection()) {
        if (buffer.startsWith('data: ')) {
          const data = buffer.slice(6).trim();
          if (data && data !== '[DONE]') {
            try {
              const qwenChunk = JSON.parse(data);
              const anthropicChunks = openaiToAnthropicResponseConverter.convertStreamChunk(
                qwenChunk,
                req.originalModel!,
                requestId,
                isFirstChunk
              );
              
              for (const anthropicChunk of anthropicChunks) {
                res.write(anthropicChunk);
              }
            } catch (parseError) {
              logger.warn('Failed to parse final buffer chunk', {
                requestId,
                error: parseError instanceof Error ? parseError.message : String(parseError)
              });
            }
          }
        }
      }
      
    } finally {
      try {
        reader.releaseLock();
      } catch (e) {
        // 忽略释放锁的错误
      }
    }
    
    // 记录流式请求完成
    const duration = Date.now() - startTime;
    logRequestEnd(requestId, 200, duration, {
      input: 0, // 流式响应中通常不返回输入token数
      output: totalOutputTokens
    });
    
    // 确保连接正常关闭
    if (!res.destroyed && !res.writableEnded) {
      res.end();
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error handling stream response', {
      requestId,
      duration,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    logRequestEnd(requestId, 500, duration);
    
    if (!res.headersSent) {
      res.status(500).json({
        type: 'error',
        error: {
          type: 'internal_server_error',
          message: 'Error occurred during streaming response'
        }
      });
    } else if (!res.destroyed && !res.writableEnded) {
      // 发送错误事件
      res.write('event: error\ndata: {"type": "error", "error": {"type": "internal_server_error", "message": "Stream processing error"}}\n\n');
      res.end();
    }
  }
}

export default router;