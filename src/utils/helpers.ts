import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// 配置Winston日志系统 - 双重输出（控制台+文件）
const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // 控制台输出 - 彩色格式
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let metaStr = '';
          if (Object.keys(meta).length > 0) {
            metaStr = ` ${JSON.stringify(meta)}`;
          }
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      )
    }),
    
    // 错误日志文件
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    
    // 所有日志文件
    new winston.transports.File({ 
      filename: 'logs/app.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    
    // 按日期轮转的访问日志
    new DailyRotateFile({
      filename: 'logs/access-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
};

// 创建全局logger实例
export const logger = winston.createLogger(loggerConfig);

export function formatError(error: Error): object {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
}

export function validateRequestBody(body: any, requiredFields: string[]): void {
  for (const field of requiredFields) {
    if (!(field in body)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}

// 生成请求ID的工具函数
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 记录请求开始
export function logRequestStart(
  requestId: string, 
  method: string, 
  url: string, 
  originalModel?: string,
  requestBody?: any
) {
  const logData: any = {
    requestId,
    method,
    url,
    originalModel,
    timestamp: new Date().toISOString()
  };
  
  // 如果启用了详细消息日志，添加请求体
  if (requestBody) {
    const config = require('../config').configManager.getConfig();
    if (config.logging.verboseMessages) {
      logData.requestBody = {
        model: requestBody.model,
        messages: requestBody.messages,
        maxTokens: requestBody.max_tokens,
        temperature: requestBody.temperature,
        stream: requestBody.stream,
        tools: requestBody.tools ? `[${requestBody.tools.length} tools]` : undefined
      };
    }
  }
  
  logger.info('Request started', logData);
}

// 记录请求结束
export function logRequestEnd(requestId: string, statusCode: number, duration: number, tokens?: { input: number; output: number }) {
  logger.info('Request completed', {
    requestId,
    statusCode,
    duration,
    inputTokens: tokens?.input || 0,
    outputTokens: tokens?.output || 0,
    timestamp: new Date().toISOString()
  });
}

/**
 * 记录转换后的OpenAI请求
 */
export function logConvertedRequest(requestId: string, convertedRequest: any) {
  const config = require('../config').configManager.getConfig();
  if (!config.logging.verboseMessages) return;
  
  logger.info('Converted request (Anthropic -> OpenAI)', {
    requestId,
    convertedRequest: {
      model: convertedRequest.model,
      messages: convertedRequest.messages,
      maxTokens: convertedRequest.max_tokens,
      temperature: convertedRequest.temperature,
      stream: convertedRequest.stream,
      tools: convertedRequest.tools ? `[${convertedRequest.tools.length} tools]` : undefined
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * 记录原始响应（来自OpenAI API）
 */
export function logOriginalResponse(requestId: string, originalResponse: any) {
  const config = require('../config').configManager.getConfig();
  if (!config.logging.verboseMessages) return;
  
  logger.info('Original response (from OpenAI API)', {
    requestId,
    originalResponse: {
      id: originalResponse.id,
      model: originalResponse.model,
      object: originalResponse.object,
      created: originalResponse.created,
      choices: originalResponse.choices?.map((choice: any) => ({
        index: choice.index,
        message: choice.message,
        finishReason: choice.finish_reason
      })),
      usage: originalResponse.usage
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * 记录转换后的Anthropic响应
 */
export function logConvertedResponse(requestId: string, convertedResponse: any) {
  const config = require('../config').configManager.getConfig();
  if (!config.logging.verboseMessages) return;
  
  logger.info('Converted response (OpenAI -> Anthropic)', {
    requestId,
    convertedResponse: {
      id: convertedResponse.id,
      type: convertedResponse.type,
      role: convertedResponse.role,
      model: convertedResponse.model,
      content: convertedResponse.content,
      stopReason: convertedResponse.stop_reason,
      stopSequence: convertedResponse.stop_sequence,
      usage: convertedResponse.usage
    },
    timestamp: new Date().toISOString()
  });
}

// 提取文本内容
export function extractTextFromContent(content: string | any[]): string {
  if (typeof content === 'string') {
    return content;
  }
  
  if (Array.isArray(content)) {
    return content
      .filter(item => item.type === 'text')
      .map(item => item.text || '')
      .join('\n');
  }
  
  return '';
}

// 生成Anthropic消息ID
export function generateAnthropicMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 获取当前时间戳
export function getCurrentTimestamp(): number {
  return Date.now();
}

// 将字符串转换为Anthropic内容格式
export function stringToAnthropicContent(text: string): any[] {
  return [{ type: 'text', text }];
}

// 安全JSON解析
export function safeJsonParse(str: string): any {
  try {
    return JSON.parse(str);
  } catch (error) {
    logger.warn('Failed to parse JSON', { error: error instanceof Error ? error.message : 'Unknown error', input: str });
    return null;
  }
}