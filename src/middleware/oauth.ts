import { Request, Response, NextFunction } from 'express';
import { qwenOAuthManager } from '@/services/qwen-oauth-manager';
import { logger } from '@/utils/helpers';

// 扩展Request类型以包含自定义属性
declare global {
  namespace Express {
    interface Request {
      qwenAccessToken?: string;
      qwenBaseUrl?: string;
      requestId?: string;
      authenticated?: boolean;
      authToken?: string;
      originalModel?: string;
      convertedBody?: any;
    }
  }
}

export class OAuthMiddleware {
  
  /**
   * 确保有有效的Qwen OAuth Token
   */
  async ensureValidToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = req.requestId || 'unknown';
    
    try {
      logger.debug('Starting OAuth token validation', { requestId });
      
      // 获取有效的访问令牌
      const accessToken = await qwenOAuthManager.getValidAccessToken();
      const baseUrl = await qwenOAuthManager.getBaseUrl();
      
      // 将token和base URL添加到请求对象
      req.qwenAccessToken = accessToken;
      req.qwenBaseUrl = baseUrl;
      
      logger.debug('OAuth token validation successful', {
        requestId,
        hasToken: !!accessToken,
        baseUrl: baseUrl
      });
      
      next();
      
    } catch (error) {
      logger.error('OAuth token validation failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(401).json({
        type: 'error',
        error: {
          type: 'authentication_error',
          message: 'Failed to obtain valid Qwen access token. Please ensure ~/.qwen/oauth_creds.json exists and contains valid credentials.'
        }
      });
    }
  }

  /**
   * 可选的认证中间件 - 不验证ANTHROPIC_AUTH_TOKEN
   * 根据设计文档，我们不需要校验ANTHROPIC_AUTH_TOKEN
   */
  optionalAuth(req: Request, res: Response, next: NextFunction): void {
    const requestId = req.requestId || 'unknown';
    
    // 从请求头获取认证信息（仅用于日志记录）
    const authHeader = req.headers.authorization;
    const authToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    
    // 标记为已认证（不进行实际验证）
    req.authenticated = true;
    req.authToken = authToken || 'sk-qwen';
    
    logger.debug('Optional authentication bypass', {
      requestId,
      hasAuthHeader: !!authHeader,
      authTokenPrefix: authToken ? authToken.substring(0, 10) + '...' : 'none'
    });
    
    next();
  }

  /**
   * 检查OAuth凭证状态的中间件（用于健康检查）
   */
  async checkCredentialStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await qwenOAuthManager.getCredentialStatus();
      req.oauthStatus = status;
      next();
    } catch (error) {
      logger.error('Failed to check OAuth credential status', {
        error: error instanceof Error ? error.message : String(error)
      });
      req.oauthStatus = {
        hasCredentials: false,
        isExpired: true,
        error: error instanceof Error ? error.message : String(error)
      };
      next();
    }
  }
}

// 扩展Request类型以包含OAuth状态
declare global {
  namespace Express {
    interface Request {
      oauthStatus?: {
        hasCredentials: boolean;
        isExpired: boolean;
        expiryDate?: string;
        resourceUrl?: string;
        error?: string;
      };
    }
  }
}

export const oauthMiddleware = new OAuthMiddleware();