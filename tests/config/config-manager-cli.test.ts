/**
 * Configuration Manager CLI Arguments Tests
 * 针对CLI参数解析和配置模式检测的单元测试
 */

import { ConfigManager } from '../../src/config/config-manager.js';
import { ConfigMode } from '../../src/types/index.js';

describe('ConfigManager CLI Arguments Tests', () => {
  let originalArgv: string[];
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // 保存原始环境
    originalArgv = [...process.argv];
    originalEnv = { ...process.env };
    
    // 清理环境变量
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    
    // 重置ConfigManager实例
    (ConfigManager as any).instance = null;
  });

  afterEach(() => {
    // 恢复原始环境
    process.argv = originalArgv;
    process.env = originalEnv;
    (ConfigManager as any).instance = null;
  });

  describe('CLI Arguments Parsing', () => {
    test('should parse space-separated arguments correctly', () => {
      process.argv = [
        'node', 'test',
        '--openai-api-key', 'ms-ef51e3fc-478f-41e9-8642-769a96da154f',
        '--openai-base-url', 'https://api-inference.modelscope.cn/v1',
        '--model', 'deepseek-ai/DeepSeek-V3.1'
      ];
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.openai.apiKey).toBe('ms-ef51e3fc-478f-41e9-8642-769a96da154f');
      expect(config.openai.baseUrl).toBe('https://api-inference.modelscope.cn/v1');
      expect(config.openai.defaultModel).toBe('deepseek-ai/DeepSeek-V3.1');
      expect(config.openai.configMode).toBe(ConfigMode.UNIVERSAL_OPENAI);
    });

    test('should parse equals-separated arguments correctly', () => {
      process.argv = [
        'node', 'test',
        '--openai-api-key=ms-ef51e3fc-478f-41e9-8642-769a96da154f',
        '--openai-base-url=https://api-inference.modelscope.cn/v1',
        '--model=deepseek-ai/DeepSeek-V3.1'
      ];
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.openai.apiKey).toBe('ms-ef51e3fc-478f-41e9-8642-769a96da154f');
      expect(config.openai.baseUrl).toBe('https://api-inference.modelscope.cn/v1');
      expect(config.openai.defaultModel).toBe('deepseek-ai/DeepSeek-V3.1');
      expect(config.openai.configMode).toBe(ConfigMode.UNIVERSAL_OPENAI);
    });

    test('should handle quoted arguments correctly', () => {
      process.argv = [
        'node', 'test',
        '--openai-api-key', '\"ms-ef51e3fc-478f-41e9-8642-769a96da154f\"',
        '--model', \"'deepseek-ai/DeepSeek-V3.1'\",
        '--openai-base-url', 'https://api-inference.modelscope.cn/v1'
      ];
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.openai.apiKey).toBe('ms-ef51e3fc-478f-41e9-8642-769a96da154f');
      expect(config.openai.defaultModel).toBe('deepseek-ai/DeepSeek-V3.1');
      expect(config.openai.configMode).toBe(ConfigMode.UNIVERSAL_OPENAI);
    });

    test('should handle incomplete quotes correctly', () => {
      process.argv = [
        'node', 'test',
        '--model', \"'deepseek-ai/DeepSeek-V3.1\", // 不完整的引号
        '--openai-api-key', 'ms-test-key'
      ];
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.openai.defaultModel).toBe('deepseek-ai/DeepSeek-V3.1');
      expect(config.openai.apiKey).toBe('ms-test-key');
      expect(config.openai.configMode).toBe(ConfigMode.UNIVERSAL_OPENAI);
    });

    test('should handle equals in values correctly', () => {
      process.argv = [
        'node', 'test',
        '--model-mapping={\"mappings\":[{\"pattern\":\"test\",\"target\":\"gpt-4\"}]}',
        '--openai-api-key=sk-test123'
      ];
      
      const configManager = ConfigManager.getInstance();
      // 通过反射访问私有字段
      const cliArgs = (configManager as any).cliArgs;
      
      expect(cliArgs.modelMapping).toBe('{\"mappings\":[{\"pattern\":\"test\",\"target\":\"gpt-4\"}]}');
      expect(cliArgs.openaiApiKey).toBe('sk-test123');
    });
  });

  describe('Configuration Mode Detection', () => {
    test('should detect UNIVERSAL_OPENAI mode with CLI API key', () => {
      process.argv = [
        'node', 'test',
        '--openai-api-key', 'sk-test123'
      ];
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.openai.configMode).toBe(ConfigMode.UNIVERSAL_OPENAI);
    });

    test('should detect UNIVERSAL_OPENAI mode with CLI base URL only', () => {
      process.argv = [
        'node', 'test',
        '--openai-base-url', 'https://api.openai.com/v1'
      ];
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.openai.configMode).toBe(ConfigMode.UNIVERSAL_OPENAI);
    });

    test('should detect UNIVERSAL_OPENAI mode with environment variables', () => {
      process.env.OPENAI_API_KEY = 'sk-env-test123';
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.openai.configMode).toBe(ConfigMode.UNIVERSAL_OPENAI);
    });

    test('should prefer CLI arguments over environment variables', () => {
      process.env.OPENAI_API_KEY = 'sk-env-key';
      process.argv = [
        'node', 'test',
        '--openai-api-key', 'sk-cli-key'
      ];
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.openai.apiKey).toBe('sk-cli-key');
      expect(config.openai.configMode).toBe(ConfigMode.UNIVERSAL_OPENAI);
    });

    test('should detect QWEN_CLI mode when no OpenAI config present', () => {
      process.argv = [
        'node', 'test',
        '--qwen-oauth-file', '/path/to/oauth.json'
      ];
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.openai.configMode).toBe(ConfigMode.QWEN_CLI);
    });
  });

  describe('Base URL Resolution', () => {
    test('should normalize base URL correctly', () => {
      process.argv = [
        'node', 'test',
        '--openai-base-url', 'https://api-inference.modelscope.cn',
        '--openai-api-key', 'ms-test'
      ];
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.openai.baseUrl).toBe('https://api-inference.modelscope.cn/v1');
    });

    test('should not duplicate /v1 suffix', () => {
      process.argv = [
        'node', 'test',
        '--openai-base-url', 'https://api-inference.modelscope.cn/v1',
        '--openai-api-key', 'ms-test'
      ];
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.openai.baseUrl).toBe('https://api-inference.modelscope.cn/v1');
    });

    test('should remove trailing slashes', () => {
      process.argv = [
        'node', 'test',
        '--openai-base-url', 'https://api-inference.modelscope.cn/v1///',
        '--openai-api-key', 'ms-test'
      ];
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.openai.baseUrl).toBe('https://api-inference.modelscope.cn/v1');
    });

    test('should add https protocol if missing', () => {
      process.argv = [
        'node', 'test',
        '--openai-base-url', 'api-inference.modelscope.cn',
        '--openai-api-key', 'ms-test'
      ];
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.openai.baseUrl).toBe('https://api-inference.modelscope.cn/v1');
    });
  });

  describe('Argument Validation', () => {
    test('should validate API key formats', () => {
      // 使用console.log的spy来捕获验证信息
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      process.argv = [
        'node', 'test',
        '--openai-api-key', 'invalid-key-format'
      ];
      
      const configManager = ConfigManager.getInstance();
      
      // 检查是否记录了验证信息
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should accept valid API key formats', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      process.argv = [
        'node', 'test',
        '--openai-api-key', 'sk-valid-openai-key',
        '--openai-base-url', 'https://api.openai.com'
      ];
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.openai.apiKey).toBe('sk-valid-openai-key');
      
      consoleSpy.mockRestore();
    });

    test('should accept ModelScope API key format', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      process.argv = [
        'node', 'test',
        '--openai-api-key', 'ms-ef51e3fc-478f-41e9-8642-769a96da154f'
      ];
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.openai.apiKey).toBe('ms-ef51e3fc-478f-41e9-8642-769a96da154f');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Integration Test - Real World Scenario', () => {
    test('should handle the exact command from user issue', () => {
      // 模拟用户提供的确切命令
      process.argv = [
        'node', 'test',
        '--openai-base-url=https://api-inference.modelscope.cn/v1',
        '--openai-api-key=ms-ef51e3fc-478f-41e9-8642-769a96da154f',
        '--model=deepseek-ai/DeepSeek-V3.1'
      ];
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      // 验证配置模式应该是UNIVERSAL_OPENAI而不是QWEN_CLI
      expect(config.openai.configMode).toBe(ConfigMode.UNIVERSAL_OPENAI);
      expect(config.openai.apiKey).toBe('ms-ef51e3fc-478f-41e9-8642-769a96da154f');
      expect(config.openai.baseUrl).toBe('https://api-inference.modelscope.cn/v1');
      expect(config.openai.defaultModel).toBe('deepseek-ai/DeepSeek-V3.1');
    });

    test('should handle the exact command with incomplete quotes', () => {
      // 模拟用户命令中的不完整引号
      process.argv = [
        'node', 'test',
        '--openai-base-url=https://api-inference.modelscope.cn/v1',
        '--openai-api-key=ms-ef51e3fc-478f-41e9-8642-769a96da154f',
        \"--model='deepseek-ai/DeepSeek-V3.1\" // 不完整的引号
      ];
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.openai.configMode).toBe(ConfigMode.UNIVERSAL_OPENAI);
      expect(config.openai.defaultModel).toBe('deepseek-ai/DeepSeek-V3.1');
    });
  });
});