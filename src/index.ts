/**
 * OpenClaude Protocol Converter
 * Main entry point for the application
 */

import { createApp, setupGracefulShutdown, startCleanupTasks } from './app.js';
import { configManager } from '@/config/index.js';

async function main(): Promise<void> {
  try {
    console.log('🚀 Starting OpenClaude Protocol Converter...');
    
    // Validate configuration
    const validation = configManager.validateConfig();
    if (!validation.valid) {
      console.error('❌ Configuration validation failed:');
      validation.errors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }
    
    console.log('✅ Configuration validated successfully');
    
    // Get server configuration
    const serverConfig = configManager.getServerConfig();
    const envInfo = configManager.getEnvironmentInfo();
    
    console.log('📋 Environment Information:');
    console.log(`  - Node.js: ${envInfo.nodeVersion}`);
    console.log(`  - Platform: ${envInfo.platform} (${envInfo.arch})`);
    console.log(`  - Environment: ${serverConfig.nodeEnv}`);
    console.log(`  - Debug Mode: ${configManager.getConfig().debugMode ? 'ON' : 'OFF'}`);
    
    // Create Express application
    const app = await createApp();
    console.log('✅ Express application created');
    
    // Setup graceful shutdown
    setupGracefulShutdown(app);
    console.log('✅ Graceful shutdown handlers registered');
    
    // Start cleanup tasks
    startCleanupTasks(app);
    console.log('✅ Cleanup tasks started');
    
    // Start server
    const server = app.listen(serverConfig.port, serverConfig.host, () => {
      console.log('🎉 OpenClaude Protocol Converter is running!');
      console.log(`📡 Server: http://${serverConfig.host}:${serverConfig.port}`);
      console.log('📚 API Endpoints:');
      console.log(`  - Messages: http://${serverConfig.host}:${serverConfig.port}/v1/messages`);
      console.log(`  - Models: http://${serverConfig.host}:${serverConfig.port}/v1/models`);
      console.log(`  - Health: http://${serverConfig.host}:${serverConfig.port}/health`);
      console.log('');
      console.log('📖 Usage Example:');
      console.log('curl -X POST http://localhost:26666/v1/messages \\');
      console.log('  -H "Content-Type: application/json" \\');
      console.log('  -H "x-api-key: your-api-key" \\');
      console.log('  -d \'{"model": "claude-3-opus-20240229", "max_tokens": 100, "messages": [{"role": "user", "content": "Hello!"}]}\'');
      console.log('');
      
      // Display feature flags
      const features = configManager.getFeatureFlags();
      console.log('🏁 Feature Flags:');
      console.log(`  - Audio Support: ${features.enableAudioSupport ? 'ENABLED' : 'DISABLED'}`);
      console.log(`  - File Support: ${features.enableFileSupport ? 'ENABLED' : 'DISABLED'}`);
      console.log(`  - Prompt Caching: ${features.enablePromptCaching ? 'ENABLED' : 'DISABLED'}`);
      console.log(`  - Metrics: ${features.enableMetrics ? 'ENABLED' : 'DISABLED'}`);
      console.log('');
      
      // Display supported models
      const supportedModels = configManager.getSupportedModels();
      console.log(`🤖 Supported Models (${supportedModels.length}):`);
      supportedModels.forEach(model => {
        const mapping = configManager.getModelMappingFor(model);
        console.log(`  - ${model} → ${mapping?.openaiModel || 'unknown'}`);
      });
      console.log('');
      console.log('✨ Ready to convert Anthropic requests to OpenAI format!');
    });
    
    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${serverConfig.port} is already in use`);
      } else if (error.code === 'EACCES') {
        console.error(`❌ Permission denied for port ${serverConfig.port}`);
      } else {
        console.error('❌ Server error:', error.message);
      }
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ Failed to start OpenClaude Protocol Converter:');
    console.error(error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
main().catch((error) => {
  console.error('❌ Application startup failed:', error);
  process.exit(1);
});