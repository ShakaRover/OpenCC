/**
 * 测试 verbose-messages 详细日志功能
 */

import { ConfigManager } from '@/config';

describe('Verbose Messages Configuration', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv;
    (ConfigManager as any).instance = null;
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  describe('CLI Parameter Parsing', () => {
    it('should parse --verbose-messages flag correctly', () => {
      process.argv = [
        'node', 'test',
        '--openai-api-key', 'sk-test123',
        '--verbose-messages'
      ];
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.logging.verboseMessages).toBe(true);
    });

    it('should default to false when not provided', () => {
      process.argv = [
        'node', 'test',
        '--openai-api-key', 'sk-test123'
      ];
      
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.logging.verboseMessages).toBe(false);
    });

    it('should support environment variable VERBOSE_MESSAGES', () => {
      const originalEnv = process.env.VERBOSE_MESSAGES;
      process.env.VERBOSE_MESSAGES = 'true';
      
      process.argv = ['node', 'test'];
      
      try {
        const configManager = ConfigManager.getInstance();
        const config = configManager.getConfig();
        
        expect(config.logging.verboseMessages).toBe(true);
      } finally {
        if (originalEnv !== undefined) {
          process.env.VERBOSE_MESSAGES = originalEnv;
        } else {
          delete process.env.VERBOSE_MESSAGES;
        }
      }
    });
  });
});