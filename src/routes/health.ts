import express, { Request, Response } from 'express';
import { logger, generateRequestId } from '@/utils/helpers';
import { configManager } from '@/config';
import { oauthMiddleware } from '@/middleware/oauth';

const router = express.Router();

// 中间件：生成请求ID
router.use((req: Request, res: Response, next) => {
  req.requestId = generateRequestId();
  next();
});

// 中间件：检查OAuth凭证状态
router.use(oauthMiddleware.checkCredentialStatus);

// GET /health - 服务健康检查端点
router.get('/', (req: Request, res: Response) => {
  const requestId = req.requestId!;
  const startTime = Date.now();
  
  logger.info('Health check requested', {
    requestId,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  
  // 获取配置信息
  const config = configManager.getConfig();
  const configMode = configManager.getConfigMode();
  const modelMapping = configManager.getModelMapping();
  
  // 基本服务状态
  const serviceStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    node_version: process.version,
    environment: config.server.nodeEnv,
    port: config.server.port,
    configMode
  };
  
  // OAuth凭证状态
  const oauthStatus = req.oauthStatus || {
    hasCredentials: false,
    isExpired: true,
    error: 'Unable to check OAuth status'
  };
  
  // 判断整体服务状态
  let overallStatus = 'healthy';
  let statusCode = 200;
  
  if (!oauthStatus.hasCredentials || oauthStatus.isExpired) {
    overallStatus = 'degraded';
    statusCode = 503; // Service Unavailable
  }
  
  const healthResponse = {
    service: 'qwen-api-proxy',
    status: overallStatus,
    timestamp: serviceStatus.timestamp,
    checks: {
      api_server: {
        status: 'healthy',
        details: {
          uptime: serviceStatus.uptime,
          memory_usage: process.memoryUsage(),
          node_version: serviceStatus.node_version
        }
      },
      oauth_credentials: {
        status: oauthStatus.hasCredentials && !oauthStatus.isExpired ? 'healthy' : 'unhealthy',
        details: {
          has_credentials: oauthStatus.hasCredentials,
          is_expired: oauthStatus.isExpired,
          expiry_date: oauthStatus.expiryDate,
          resource_url: oauthStatus.resourceUrl,
          error: oauthStatus.error
        }
      },
      model_configuration: {
        status: 'healthy',
        details: {
          config_mode: configMode,
          default_model: config.openai.defaultModel || (configMode === 'qwen-cli' ? 'qwen3-coder-plus' : 'none'),
          mapping_rules_count: modelMapping.mappings.length,
          has_default_mapping: !!modelMapping.defaultModel,
          supported_anthropic_models: modelMapping.mappings.map(rule => rule.pattern),
          openai_base_url: config.openai.baseUrl
        }
      }
    },
    configuration: {
      version: serviceStatus.version,
      environment: serviceStatus.environment,
      port: serviceStatus.port,
      log_level: process.env.LOG_LEVEL || 'info'
    }
  };
  
  const duration = Date.now() - startTime;
  
  logger.info('Health check completed', {
    requestId,
    status: overallStatus,
    duration,
    oauthHealthy: oauthStatus.hasCredentials && !oauthStatus.isExpired
  });
  
  res.status(statusCode).json(healthResponse);
});

// GET /health/ready - 就绪检查（Kubernetes readiness probe）
router.get('/ready', (req: Request, res: Response) => {
  const requestId = req.requestId!;
  
  logger.debug('Readiness check requested', { requestId });
  
  // 简单的就绪检查
  const readyResponse = {
    status: 'ready',
    timestamp: new Date().toISOString()
  };
  
  res.json(readyResponse);
});

// GET /health/live - 存活检查（Kubernetes liveness probe）
router.get('/live', (req: Request, res: Response) => {
  const requestId = req.requestId!;
  
  logger.debug('Liveness check requested', { requestId });
  
  // 简单的存活检查
  const liveResponse = {
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
  
  res.json(liveResponse);
});

export default router;