/**
 * ConfigManager Tests
 */

import { ConfigManager } from '../../src/config/config-manager.js';
import { ConfigMode } from '../../src/types/index.js';

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    // Reset environment variables
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    
    // Reset command line arguments
    process.argv = ['node', 'test'];
    
    // Create new instance
    configManager = new (ConfigManager as any)();
  });

  describe('Configuration Mode Detection', () => {
    it('should default to qwen-cli mode when no OpenAI parameters are provided', () => {
      const mode = (configManager as any).detectConfigMode();
      expect(mode).toBe(ConfigMode.QWEN_CLI);
    });

    it('should use universal OpenAI mode when API key is provided via environment', () => {
      process.env.OPENAI_API_KEY = 'sk-test123';
      const mode = (configManager as any).detectConfigMode();
      expect(mode).toBe(ConfigMode.UNIVERSAL_OPENAI);
    });

    it('should use universal OpenAI mode when base URL is provided via environment', () => {
      process.env.OPENAI_BASE_URL = 'https://api.custom.com';
      const mode = (configManager as any).detectConfigMode();
      expect(mode).toBe(ConfigMode.UNIVERSAL_OPENAI);
    });

    it('should use universal OpenAI mode when API key is provided via CLI', () => {
      process.argv = ['node', 'test', '--openai-api-key', 'sk-test123'];
      const args = (configManager as any).parseCliArguments();
      expect(args.openaiApiKey).toBe('sk-test123');
    });
  });

  describe('Base URL Resolution', () => {
    it('should add /v1 suffix if not present', () => {
      const resolved = (configManager as any).resolveBaseUrl('https://api.custom.com');
      expect(resolved).toBe('https://api.custom.com/v1');
    });

    it('should not duplicate /v1 suffix', () => {
      const resolved = (configManager as any).resolveBaseUrl('https://api.custom.com/v1');
      expect(resolved).toBe('https://api.custom.com/v1');
    });

    it('should remove trailing slashes', () => {
      const resolved = (configManager as any).resolveBaseUrl('https://api.custom.com/');
      expect(resolved).toBe('https://api.custom.com/v1');
    });

    it('should add https protocol if missing', () => {
      const resolved = (configManager as any).resolveBaseUrl('api.custom.com');
      expect(resolved).toBe('https://api.custom.com/v1');
    });
  });

  describe('CLI Arguments Parsing', () => {
    it('should parse all supported CLI arguments', () => {
      process.argv = [
        'node', 'test',
        '--openai-api-key', 'sk-test123',
        '--openai-base-url', 'https://api.custom.com',
        '--qwen-oauth-file', '/path/to/oauth.json',
        '--model', 'gpt-4',
        '--model-mapping', '{"mappings": []}'
      ];
      
      const args = (configManager as any).parseCliArguments();
      
      expect(args.openaiApiKey).toBe('sk-test123');
      expect(args.openaiBaseUrl).toBe('https://api.custom.com');
      expect(args.qwenOauthFile).toBe('/path/to/oauth.json');
      expect(args.model).toBe('gpt-4');
      expect(args.modelMapping).toBe('{"mappings": []}');
    });
  });

  describe('Model Mapping Conversion', () => {
    it('should convert new format mapping correctly', () => {
      const newFormatMapping = {
        mappings: [
          {
            pattern: 'claude-3-opus',
            target: 'gpt-4',
            type: 'contains'
          }
        ],
        defaultModel: 'gpt-3.5-turbo'
      };
      
      const converted = (configManager as any).convertToEnhancedMapping(newFormatMapping);
      
      expect(converted.mappings).toHaveLength(1);
      expect(converted.mappings[0].pattern).toBe('claude-3-opus');
      expect(converted.mappings[0].target).toBe('gpt-4');
      expect(converted.mappings[0].type).toBe('contains');
      expect(converted.defaultModel).toBe('gpt-3.5-turbo');
    });

    it('should convert legacy format mapping correctly', () => {
      const legacyMapping = {
        'claude-3-opus-20240229': {
          openaiModel: 'gpt-4-turbo-preview',
          contextLength: 128000,
          maxTokens: 4096,
          capabilities: ['text', 'images']
        }
      };
      
      const converted = (configManager as any).convertToEnhancedMapping(legacyMapping);
      
      expect(converted.mappings).toHaveLength(1);
      expect(converted.mappings[0].pattern).toBe('claude-3-opus-20240229');
      expect(converted.mappings[0].target).toBe('gpt-4-turbo-preview');
      expect(converted.mappings[0].type).toBe('exact');
    });

    it('should support targetModel field in legacy mapping', () => {
      const legacyMapping = {
        'claude-3-opus-20240229': {
          targetModel: 'gpt-4-turbo-preview'
        }
      };
      
      const converted = (configManager as any).convertToEnhancedMapping(legacyMapping);
      
      expect(converted.mappings).toHaveLength(1);
      expect(converted.mappings[0].target).toBe('gpt-4-turbo-preview');
    });
  });

  describe('Model Resolution', () => {
    beforeEach(() => {
      const enhancedMapping = {
        mappings: [
          { pattern: 'claude-3-opus', target: 'gpt-4', type: 'contains' },
          { pattern: 'claude-3-sonnet', target: 'gpt-3.5-turbo', type: 'contains' },
          { pattern: 'qwen-plus', target: 'qwen3-coder-plus', type: 'exact' }
        ],
        defaultModel: 'gpt-3.5-turbo'
      };
      
      (configManager as any).modelMapping = enhancedMapping;
    });

    it('should match exact patterns', () => {
      const result = configManager.getEffectiveModel('qwen-plus');
      expect(result).toBe('qwen3-coder-plus');
    });

    it('should match contains patterns', () => {
      const result = configManager.getEffectiveModel('claude-3-opus-20240229');
      expect(result).toBe('gpt-4');
    });

    it('should use defaultModel when no pattern matches', () => {
      const result = configManager.getEffectiveModel('unknown-model');
      expect(result).toBe('gpt-3.5-turbo');
    });

    it('should return original model when no mapping or default', () => {
      (configManager as any).modelMapping = { mappings: [] };
      const result = configManager.getEffectiveModel('unknown-model');
      expect(result).toBe('unknown-model');
    });
  });

  describe('Model Pattern Matching', () => {
    it('should match exact patterns correctly', () => {
      const isMatch = (configManager as any).isModelMatch('gpt-4', 'gpt-4', 'exact');
      expect(isMatch).toBe(true);
      
      const isNotMatch = (configManager as any).isModelMatch('gpt-4-turbo', 'gpt-4', 'exact');
      expect(isNotMatch).toBe(false);
    });

    it('should match prefix patterns correctly', () => {
      const isMatch = (configManager as any).isModelMatch('claude-3-opus', 'claude-', 'prefix');
      expect(isMatch).toBe(true);
      
      const isNotMatch = (configManager as any).isModelMatch('gpt-4', 'claude-', 'prefix');
      expect(isNotMatch).toBe(false);
    });

    it('should match suffix patterns correctly', () => {
      const isMatch = (configManager as any).isModelMatch('gpt-4-turbo', '-turbo', 'suffix');
      expect(isMatch).toBe(true);
      
      const isNotMatch = (configManager as any).isModelMatch('gpt-4', '-turbo', 'suffix');
      expect(isNotMatch).toBe(false);
    });

    it('should match contains patterns correctly', () => {
      const isMatch = (configManager as any).isModelMatch('claude-3-opus-20240229', 'opus', 'contains');
      expect(isMatch).toBe(true);
      
      const isNotMatch = (configManager as any).isModelMatch('claude-3-sonnet', 'opus', 'contains');
      expect(isNotMatch).toBe(false);
    });
  });
});