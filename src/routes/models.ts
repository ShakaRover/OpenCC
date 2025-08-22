import express, { Request, Response } from 'express';
import { logger, generateRequestId } from '../utils/helpers.js';
import { oauthMiddleware } from '../middleware/oauth.js';

const router = express.Router();

// 中间件：生成请求ID
router.use((req: Request, res: Response, next) => {
  req.requestId = generateRequestId();
  next();
});

// 中间件：可选认证
router.use(oauthMiddleware.optionalAuth);

// GET /v1/models - 返回qwen3-coder-plus模型信息
router.get('/', (req: Request, res: Response) => {
  const requestId = req.requestId!;
  
  logger.info('Models endpoint accessed', {
    requestId,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  
  // 根据设计文档，我们只支持qwen3-coder-plus模型
  const modelsResponse = {
    object: 'list',
    data: [
      {
        id: 'qwen3-coder-plus',
        object: 'model',
        created: 1704067200, // 固定时间戳
        owned_by: 'qwen',
        permission: [],
        root: 'qwen3-coder-plus',
        parent: null
      },
      // 也支持Anthropic模型名称（但实际会映射到qwen3-coder-plus）
      {
        id: 'claude-3-opus-20240229',
        object: 'model',
        created: 1704067200,
        owned_by: 'anthropic',
        permission: [],
        root: 'claude-3-opus-20240229',
        parent: null
      },
      {
        id: 'claude-3-sonnet-20240229',
        object: 'model',
        created: 1704067200,
        owned_by: 'anthropic',
        permission: [],
        root: 'claude-3-sonnet-20240229',
        parent: null
      },
      {
        id: 'claude-3-haiku-20240307',
        object: 'model',
        created: 1704067200,
        owned_by: 'anthropic',
        permission: [],
        root: 'claude-3-haiku-20240307',
        parent: null
      }
    ]
  };
  
  logger.debug('Returning models list', {
    requestId,
    modelCount: modelsResponse.data.length,
    actualModel: 'qwen3-coder-plus'
  });
  
  res.json(modelsResponse);
});

export default router;