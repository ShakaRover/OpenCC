import app from './app';
import { logger } from './utils/helpers';
import { configManager } from './config';

// 启动服务器
async function startServer() {
  try {
    // 初始化配置管理器并加载模型映射
    await configManager.loadModelMapping();
    
    const config = configManager.getConfig();
    const PORT = config.server.port;
    const HOST = config.server.host;
    const configMode = configManager.getConfigMode();
    
    logger.info('Starting OpenCC API proxy server...', {
      port: PORT,
      host: HOST,
      configMode,
      nodeEnv: config.server.nodeEnv,
      nodeVersion: process.version,
      openaiBaseUrl: config.openai.baseUrl,
      hasApiKey: !!config.openai.apiKey,
      defaultModel: config.openai.defaultModel
    });
    
    const server = app.listen(PORT, HOST, () => {
      logger.info('Server started successfully', {
        message: `OpenCC API proxy server is running on http://${HOST}:${PORT}`,
        port: PORT,
        host: HOST,
        configMode,
        endpoints: {
          health: `http://${HOST}:${PORT}/health`,
          messages: `http://${HOST}:${PORT}/v1/messages`,
          models: `http://${HOST}:${PORT}/v1/models`
        }
      });
      
      if (configMode === 'qwen-cli') {
        logger.info('Qwen-CLI mode setup instructions', {
          message: 'To use with Claude Code, set these environment variables:',
          instructions: [
            `export ANTHROPIC_BASE_URL=http://127.0.0.1:${PORT}`,
            'export ANTHROPIC_AUTH_TOKEN=sk-qwen'
          ]
        });
      } else {
        logger.info('Universal OpenAI mode enabled', {
          message: 'Using custom OpenAI configuration',
          baseUrl: config.openai.baseUrl,
          defaultModel: config.openai.defaultModel
        });
      }
    });
    
    // 处理服务器错误
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.error('Port already in use', {
          port: PORT,
          host: HOST,
          suggestion: `Please try a different port by setting PORT environment variable`
        });
      } else {
        logger.error('Server error', {
          error: err.message,
          code: err.code,
          stack: err.stack
        });
      }
      process.exit(1);
    });
    
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// 启动服务
startServer().catch((error) => {
  logger.error('Unhandled error during startup', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
});