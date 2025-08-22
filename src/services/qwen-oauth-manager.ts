import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { logger } from '../utils/helpers.js';

interface OAuthCredentials {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  resource_url: string;
}

export class QwenOAuthManager {
  private oauth_creds: OAuthCredentials | null = null;
  private readonly oauthFilePath: string;
  private readonly clientId = 'f0304373b74a44d2b584a3fb70ca9e56';
  private readonly tokenRefreshUrl = 'https://chat.qwen.ai/api/v1/oauth2/token';

  constructor() {
    this.oauthFilePath = process.env.QWEN_OAUTH_CREDS_PATH || 
                       path.join(os.homedir(), '.qwen', 'oauth_creds.json');
  }

  /**
   * 获取有效的访问令牌，自动处理刷新
   */
  async getValidAccessToken(): Promise<string> {
    // 如果还没有加载凭证，先加载
    if (!this.oauth_creds) {
      await this.loadOAuthCredentials();
    }

    // 如果没有凭证文件，抛出错误
    if (!this.oauth_creds) {
      const error = 'OAuth credentials file not found. Please ensure ~/.qwen/oauth_creds.json exists';
      logger.error('OAuth credentials missing', { filePath: this.oauthFilePath });
      throw new Error(error);
    }

    // 检查token是否需要刷新（提前1分钟刷新）
    if (this.oauth_creds.expiry_date < Date.now()) {
      logger.info('OAuth token expired, refreshing...', {
        expiry: new Date(this.oauth_creds.expiry_date).toISOString(),
        current: new Date().toISOString()
      });
      
      await this.refreshToken(this.oauth_creds.refresh_token);
    }

    return this.oauth_creds.access_token;
  }

  /**
   * 获取Qwen API的Base URL
   */
  async getBaseUrl(): Promise<string> {
    if (!this.oauth_creds) {
      await this.loadOAuthCredentials();
    }

    if (!this.oauth_creds) {
      throw new Error('OAuth credentials not available');
    }

    // 确保有协议头
    const resourceUrl = this.oauth_creds.resource_url;
    if (resourceUrl.startsWith('http://') || resourceUrl.startsWith('https://')) {
      return resourceUrl;
    }
    
    return `https://${resourceUrl}`;
  }

  /**
   * 刷新访问令牌
   */
  private async refreshToken(refreshToken: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting OAuth token refresh', { refreshToken: refreshToken.substring(0, 10) + '...' });
      
      const urlencoded = new URLSearchParams();
      urlencoded.append('client_id', this.clientId);
      urlencoded.append('refresh_token', refreshToken);
      urlencoded.append('grant_type', 'refresh_token');

      const response = await fetch(this.tokenRefreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: urlencoded,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('OAuth token refresh failed', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // 构建新的凭证数据，保持与qwen-cli.js一致的格式
      const newCredentials: OAuthCredentials = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken, // 有些情况下refresh_token可能不变
        expiry_date: Date.now() + data.expires_in * 1000 - 60000, // 提前1分钟过期
        resource_url: data.resource_url || this.oauth_creds?.resource_url || 'chat.qwen.ai'
      };

      // 更新内存中的凭证
      this.oauth_creds = newCredentials;

      // 保存到文件
      await this.saveOAuthCredentials(newCredentials);

      const duration = Date.now() - startTime;
      logger.info('OAuth token refreshed successfully', {
        duration,
        newExpiry: new Date(newCredentials.expiry_date).toISOString(),
        resourceUrl: newCredentials.resource_url
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('OAuth token refresh failed', {
        error: error instanceof Error ? error.message : String(error),
        duration
      });
      throw error;
    }
  }

  /**
   * 从文件加载OAuth凭证
   */
  private async loadOAuthCredentials(): Promise<void> {
    try {
      logger.debug('Loading OAuth credentials', { filePath: this.oauthFilePath });
      
      const data = await fs.readFile(this.oauthFilePath, 'utf-8');
      this.oauth_creds = JSON.parse(data);
      
      logger.info('OAuth credentials loaded successfully', {
        hasAccessToken: !!this.oauth_creds?.access_token,
        hasRefreshToken: !!this.oauth_creds?.refresh_token,
        resourceUrl: this.oauth_creds?.resource_url,
        expiryDate: this.oauth_creds?.expiry_date ? new Date(this.oauth_creds.expiry_date).toISOString() : null
      });
      
    } catch (error) {
      logger.warn('Failed to load OAuth credentials', {
        filePath: this.oauthFilePath,
        error: error instanceof Error ? error.message : String(error)
      });
      this.oauth_creds = null;
    }
  }

  /**
   * 保存OAuth凭证到文件
   */
  private async saveOAuthCredentials(credentials: OAuthCredentials): Promise<void> {
    try {
      // 确保目录存在
      const dir = path.dirname(this.oauthFilePath);
      await fs.mkdir(dir, { recursive: true });

      // 保存文件，保持格式化
      await fs.writeFile(this.oauthFilePath, JSON.stringify(credentials, null, 2));
      
      logger.debug('OAuth credentials saved successfully', {
        filePath: this.oauthFilePath,
        expiryDate: new Date(credentials.expiry_date).toISOString()
      });
      
    } catch (error) {
      logger.error('Failed to save OAuth credentials', {
        filePath: this.oauthFilePath,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 检查当前凭证状态
   */
  async getCredentialStatus(): Promise<{
    hasCredentials: boolean;
    isExpired: boolean;
    expiryDate?: string;
    resourceUrl?: string;
  }> {
    if (!this.oauth_creds) {
      await this.loadOAuthCredentials();
    }

    if (!this.oauth_creds) {
      return { hasCredentials: false, isExpired: true };
    }

    const isExpired = this.oauth_creds.expiry_date < Date.now();
    
    return {
      hasCredentials: true,
      isExpired,
      expiryDate: new Date(this.oauth_creds.expiry_date).toISOString(),
      resourceUrl: this.oauth_creds.resource_url
    };
  }
}

// 导出单例实例
export const qwenOAuthManager = new QwenOAuthManager();