import express from 'express';
import cors from 'cors';
import { logger } from './utils/helpers.js';
import messagesRouter from './routes/messages.js';
import modelsRouter from './routes/models.js';
import healthRouter from './routes/health.js';

// 创建Express应用
const app = express();

// 信任代理（用于获取真实IP）
app.set('trust proxy', true);

// 请求日志中间件
app.use((req, res, next) => {
  const startTime = Date.now();
  
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    contentType: req.get('Content-Type')
  });
  
  // 记录响应完成
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('Content-Length')
    });
  });
  
  next();
});

// CORS中间件
app.use(cors({
  origin: function (origin, callback) {
    // 允许没有origin的请求（如移动应用或桌面应用）
    if (!origin) return callback(null, true);
    
    // 允许本地开发和Claude Code的连接
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'vscode-webview://',
      'vscode-file://',
      'file://',
      // Claude Code 相关的origins
      /^vscode-webview:/,
      /^https?:\/\/localhost/,
      /^https?:\/\/127\.0\.0\.1/
    ];
    
    // 检查origin是否在允许列表中
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed || origin.startsWith(allowed);
      }
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn('CORS: Origin not allowed', { origin });
      callback(null, true); // 暂时允许所有连接以便调试
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'User-Agent',
    'X-Requested-With',
    'Accept',
    'Cache-Control',
    'X-Request-ID'
  ],
  credentials: true,
  optionsSuccessStatus: 200 // 某些浏览器（IE11，各种SmartTV）在204时会出现问题
}));

// 解析JSON请求体
app.use(express.json({ 
  limit: '10mb',
  type: 'application/json'
}));

// 解析URL编码的请求体
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// 处理OPTIONS预检请求
app.options('*', (req, res) => {
  logger.debug('OPTIONS preflight request', {
    method: req.method,
    url: req.url,
    origin: req.get('Origin'),
    headers: req.headers
  });
  
  res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, User-Agent, Accept, Cache-Control, X-Request-ID');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24小时
  res.sendStatus(200);
});

// 路由配置
app.use('/v1/messages', messagesRouter);
app.use('/v1/models', modelsRouter);
app.use('/health', healthRouter);

// 根路径重定向到健康检查
app.get('/', (req, res) => {
  res.redirect('/health');
});

// 处理favicon.ico请求
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // 返回空响应，状态码204表示无内容
});

// 404处理
app.use('*', (req, res) => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip
  });
  
  res.status(404).json({
    type: 'error',
    error: {
      type: 'not_found_error',
      message: `Route ${req.method} ${req.originalUrl || req.url} not found`
    }
  });
});

// 全局错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  
  // 检查是否已经发送了响应
  if (res.headersSent) {
    return next(err);
  }
  
  // 发送错误响应
  res.status(500).json({
    type: 'error',
    error: {
      type: 'internal_server_error',
      message: 'An internal server error occurred'
    }
  });
});

// 优雅关闭处理
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// 未捕获异常处理
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', {
    error: err.message,
    stack: err.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
  process.exit(1);
});

export default app;