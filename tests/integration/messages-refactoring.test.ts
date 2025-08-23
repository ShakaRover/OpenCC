/**
 * Integration Tests for Messages Refactoring
 * Tests the refactored messages route with provider abstraction layer
 */

import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { providerMiddleware } from '../../src/middleware/provider.js';
import messagesRouter from '../../src/routes/messages.js';
import { configManager } from '../../src/config/index.js';
import { ConfigMode } from '../../src/types/common.js';

// Mock the config manager
jest.mock('../../src/config/index.js');
const mockConfigManager = configManager as jest.Mocked<typeof configManager>;

// Mock Qwen OAuth manager
jest.mock('../../src/services/qwen-oauth-manager.js', () => ({
  qwenOAuthManager: {
    getValidAccessToken: jest.fn().mockResolvedValue('mock-token'),
    getBaseUrl: jest.fn().mockResolvedValue('https://api.qwen.com'),
    getCredentialStatus: jest.fn().mockResolvedValue({
      hasCredentials: true,
      isExpired: false,
      expiryDate: new Date(Date.now() + 3600000).toISOString()
    })
  }
}));

describe('Messages Route Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    // Setup test app
    app = express();
    app.use(express.json());
    app.use('/v1/messages', messagesRouter);
  });

  afterAll(() => {
    // Clean up provider cache
    providerMiddleware.clearCache();
  });

  describe('Qwen Provider Mode', () => {
    beforeAll(() => {
      // Mock Qwen configuration
      mockConfigManager.getConfigMode.mockReturnValue(ConfigMode.QWEN_CLI);
      mockConfigManager.getConfig.mockReturnValue({
        server: {
          port: 26666,
          host: 'localhost',
          nodeEnv: 'test' as any,
          corsOrigin: '*',
          corsCredentials: false
        },
        openai: {
          apiKey: '',
          baseUrl: 'https://ai-qwen.com',
          timeout: 60000,
          maxRetries: 3,
          configMode: ConfigMode.QWEN_CLI,
          oauthFilePath: '~/.qwen/oauth_creds.json',
          defaultModel: 'qwen-max'
        },
        rateLimit: {
          windowMs: 900000,
          maxRequests: 100
        },
        logging: {
          level: 'debug' as any,
          format: 'json' as any,
          verboseLogging: false
        },
        features: {
          enableAudioSupport: false,
          enableFileSupport: false,
          enablePromptCaching: false,
          enableMetrics: false
        },
        apiVersion: '1.0.0',
        requestTimeout: 60000,
        maxRequestSize: '10mb',
        healthCheckEnabled: true,
        debugMode: true
      });
    });

    test('should handle valid Anthropic request with Qwen provider', async () => {
      const anthropicRequest = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: 'Hello, test message'
          }
        ]
      };

      // Mock fetch to simulate Qwen API response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'mock-response-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'qwen-max',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! This is a test response.'
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 15,
            total_tokens: 25
          }
        })
      }) as jest.MockedFunction<typeof fetch>;

      const response = await request(app)
        .post('/v1/messages')
        .send(anthropicRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        type: 'message',
        role: 'assistant',
        content: expect.any(Array),
        model: 'claude-3-sonnet-20240229',
        usage: {
          input_tokens: expect.any(Number),
          output_tokens: expect.any(Number)
        }
      });
    }, 30000);

    test('should handle provider authentication errors', async () => {
      // Mock authentication failure
      const { qwenOAuthManager } = await import('../../src/services/qwen-oauth-manager.js');
      jest.mocked(qwenOAuthManager.getValidAccessToken).mockRejectedValueOnce(
        new Error('OAuth credentials expired')
      );

      const anthropicRequest = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: 'Hello, test message'
          }
        ]
      };

      const response = await request(app)
        .post('/v1/messages')
        .send(anthropicRequest)
        .expect(401);

      expect(response.body).toMatchObject({
        type: 'error',
        error: {
          type: 'authentication_error',
          message: expect.stringContaining('authentication failed')
        }
      });
    });
  });

  describe('Universal OpenAI Provider Mode', () => {
    beforeAll(() => {
      // Mock OpenAI configuration
      mockConfigManager.getConfigMode.mockReturnValue(ConfigMode.UNIVERSAL_OPENAI);
      mockConfigManager.getConfig.mockReturnValue({
        server: {
          port: 26666,
          host: 'localhost',
          nodeEnv: 'test' as any,
          corsOrigin: '*',
          corsCredentials: false
        },
        openai: {
          apiKey: 'sk-test-api-key',
          baseUrl: 'https://api.openai.com/v1',
          timeout: 30000,
          maxRetries: 3,
          configMode: ConfigMode.UNIVERSAL_OPENAI,
          defaultModel: 'gpt-3.5-turbo'
        },
        rateLimit: {
          windowMs: 900000,
          maxRequests: 100
        },
        logging: {
          level: 'debug' as any,
          format: 'json' as any,
          verboseLogging: false
        },
        features: {
          enableAudioSupport: false,
          enableFileSupport: false,
          enablePromptCaching: false,
          enableMetrics: false
        },
        apiVersion: '1.0.0',
        requestTimeout: 30000,
        maxRequestSize: '10mb',
        healthCheckEnabled: true,
        debugMode: true
      });

      // Clear provider cache to ensure new config is used
      providerMiddleware.clearCache();
    });

    test('should handle valid Anthropic request with OpenAI provider', async () => {
      const anthropicRequest = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: 'Hello, test message'
          }
        ]
      };

      // Mock fetch to simulate OpenAI API response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-3.5-turbo',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! This is a test response from OpenAI.'
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 18,
            total_tokens: 30
          }
        })
      }) as jest.MockedFunction<typeof fetch>;

      const response = await request(app)
        .post('/v1/messages')
        .send(anthropicRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        type: 'message',
        role: 'assistant',
        content: expect.any(Array),
        model: 'claude-3-sonnet-20240229',
        usage: {
          input_tokens: expect.any(Number),
          output_tokens: expect.any(Number)
        }
      });
    }, 30000);

    test('should handle OpenAI API errors gracefully', async () => {
      // Mock OpenAI API error
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => JSON.stringify({
          error: {
            message: 'Invalid request format',
            type: 'invalid_request_error'
          }
        })
      }) as jest.MockedFunction<typeof fetch>;

      const anthropicRequest = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: 'Hello, test message'
          }
        ]
      };

      const response = await request(app)
        .post('/v1/messages')
        .send(anthropicRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        type: 'error',
        error: {
          type: 'api_error',
          message: expect.stringContaining('API provider error')
        }
      });
    });
  });

  describe('Request Validation', () => {
    test('should reject invalid Anthropic requests', async () => {
      const invalidRequest = {
        // Missing required fields
        max_tokens: 1024
      };

      const response = await request(app)
        .post('/v1/messages')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message: expect.stringContaining('Invalid request')
        }
      });
    });

    test('should reject empty messages array', async () => {
      const invalidRequest = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        messages: []
      };

      const response = await request(app)
        .post('/v1/messages')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message: expect.stringContaining('Invalid request')
        }
      });
    });
  });

  describe('Backward Compatibility', () => {
    test('should maintain the same response format as before refactoring', async () => {
      const anthropicRequest = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: 'Hello, compatibility test'
          }
        ]
      };

      // Mock successful response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'test-response-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'qwen-max',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Compatibility test response.'
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 8,
            completion_tokens: 12,
            total_tokens: 20
          }
        })
      }) as jest.MockedFunction<typeof fetch>;

      const response = await request(app)
        .post('/v1/messages')
        .send(anthropicRequest)
        .expect(200);

      // Verify response structure matches Anthropic format
      expect(response.body).toHaveProperty('type', 'message');
      expect(response.body).toHaveProperty('role', 'assistant');
      expect(response.body).toHaveProperty('content');
      expect(response.body).toHaveProperty('model', 'claude-3-sonnet-20240229');
      expect(response.body).toHaveProperty('usage');
      expect(response.body.usage).toHaveProperty('input_tokens');
      expect(response.body.usage).toHaveProperty('output_tokens');
      expect(Array.isArray(response.body.content)).toBe(true);
    });
  });
});