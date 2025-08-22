import app from './app.js';
import { logger } from './utils/helpers.js';

// 从环境变量获取端口，默认是26666
const PORT = parseInt(process.env.PORT || '26666', 10);
const HOST = process.env.HOST || 'localhost';

// 启动服务器
async function startServer() {
  try {
    logger.info('Starting Qwen API proxy server...', {
      port: PORT,
      host: HOST,
      nodeEnv: process.env.NODE_ENV || 'development',
      nodeVersion: process.version
    });
    
    const server = app.listen(PORT, HOST, () => {
      logger.info('Server started successfully', {
        message: `Qwen API proxy server is running on http://${HOST}:${PORT}`,
        port: PORT,
        host: HOST,
        endpoints: {
          health: `http://${HOST}:${PORT}/health`,
          messages: `http://${HOST}:${PORT}/v1/messages`,
          models: `http://${HOST}:${PORT}/v1/models`
        }
      });
      
      logger.info('Setup instructions', {
        message: 'To use with Claude Code, set these environment variables:',
        instructions: [
          `export ANTHROPIC_BASE_URL=http://127.0.0.1:${PORT}`,
          'export ANTHROPIC_AUTH_TOKEN=sk-qwen'
        ]
      });
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