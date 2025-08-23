/**
 * Provider System Unit Tests
 * Tests the core provider abstraction layer functionality
 */

import { describe, test, expect } from '@jest/globals';
import { URLBuilder } from '../../src/providers/base/url-builder.js';
import { getProtocolEndpoints, getEndpoint, ProtocolType } from '../../src/providers/base/protocol-endpoints.js';

describe('Provider System Core Tests', () => {
  describe('URL Builder', () => {
    test('should build OpenAI-compatible URLs correctly', () => {
      const baseUrl = 'https://api.openai.com';
      const endpoint = {
        type: 'chat' as const,
        method: 'POST' as const,
        path: '/v1/chat/completions'
      };

      const url = URLBuilder.buildURL(baseUrl, endpoint);
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
    });

    test('should handle path variables correctly', () => {
      const baseUrl = 'https://generativelanguage.googleapis.com';
      const endpoint = {
        type: 'chat' as const,
        method: 'POST' as const,
        path: '/v1beta/models/{model}:generateContent',
        requiresModel: true,
        modelPlacement: 'path' as const,
        pathVariables: ['model']
      };

      const url = URLBuilder.buildURL(baseUrl, endpoint, {
        model: 'gemini-pro'
      });
      expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent');
    });

    test('should handle query parameters correctly', () => {
      const baseUrl = 'https://api.example.com';
      const endpoint = {
        type: 'models' as const,
        method: 'GET' as const,
        path: '/v1/models'
      };

      const url = URLBuilder.buildURL(baseUrl, endpoint, {
        queryParams: {
          limit: '10',
          offset: '0'
        }
      });
      expect(url).toBe('https://api.example.com/v1/models?limit=10&offset=0');
    });

    test('should validate base URL format', () => {
      expect(() => {
        URLBuilder.buildURL('invalid-url', {
          type: 'chat' as const,
          method: 'POST' as const,
          path: '/test'
        });
      }).toThrow('Invalid base URL format');
    });

    test('should require model parameter when needed', () => {
      const baseUrl = 'https://api.example.com';
      const endpoint = {
        type: 'chat' as const,
        method: 'POST' as const,
        path: '/v1beta/models/{model}:generateContent',
        requiresModel: true,
        pathVariables: ['model']
      };

      expect(() => {
        URLBuilder.buildURL(baseUrl, endpoint); // No model provided
      }).toThrow('Required path variable');
    });
  });

  describe('Protocol Endpoints', () => {
    test('should provide OpenAI protocol endpoints', () => {
      const endpoints = getProtocolEndpoints(ProtocolType.OPENAI);
      
      expect(endpoints.chat).toMatchObject({
        type: 'chat',
        method: 'POST',
        path: '/v1/chat/completions'
      });
      
      expect(endpoints.models).toMatchObject({
        type: 'models',
        method: 'GET',
        path: '/v1/models'
      });
    });

    test('should provide Gemini protocol endpoints', () => {
      const endpoints = getProtocolEndpoints(ProtocolType.GEMINI);
      
      expect(endpoints.chat).toMatchObject({
        type: 'chat',
        method: 'POST',
        path: '/v1beta/models/{model}:generateContent',
        requiresModel: true,
        modelPlacement: 'path',
        pathVariables: ['model']
      });
    });

    test('should get specific endpoint by type', () => {
      const chatEndpoint = getEndpoint(ProtocolType.OPENAI, 'chat');
      
      expect(chatEndpoint).toMatchObject({
        type: 'chat',
        method: 'POST',
        path: '/v1/chat/completions'
      });
    });

    test('should throw error for unsupported protocol', () => {
      expect(() => {
        getProtocolEndpoints('unsupported' as any);
      }).toThrow('Unsupported protocol');
    });

    test('should throw error for unsupported endpoint type', () => {
      expect(() => {
        getEndpoint(ProtocolType.OPENAI, 'unsupported' as any);
      }).toThrow('not supported by protocol');
    });
  });

  describe('Path Template Validation', () => {
    test('should extract path variables correctly', () => {
      const variables = URLBuilder.extractPathVariables('/v1beta/models/{model}:generateContent');
      expect(variables).toEqual(['model']);
    });

    test('should extract multiple path variables', () => {
      const variables = URLBuilder.extractPathVariables('/api/{version}/users/{userId}/posts/{postId}');
      expect(variables).toEqual(['version', 'userId', 'postId']);
    });

    test('should return empty array for path without variables', () => {
      const variables = URLBuilder.extractPathVariables('/v1/chat/completions');
      expect(variables).toEqual([]);
    });

    test('should detect path variables', () => {
      expect(URLBuilder.hasPathVariables('/v1/models/{model}')).toBe(true);
      expect(URLBuilder.hasPathVariables('/v1/chat/completions')).toBe(false);
    });

    test('should validate path template format', () => {
      const valid = URLBuilder.validatePathTemplate('/v1/models/{model}:generate');
      expect(valid.isValid).toBe(true);
      expect(valid.variables).toEqual(['model']);
      expect(valid.errors).toEqual([]);
    });

    test('should detect malformed path template', () => {
      const invalid = URLBuilder.validatePathTemplate('/v1/models/{model');
      expect(invalid.isValid).toBe(false);
      expect(invalid.errors.length).toBeGreaterThan(0);
    });

    test('should detect empty variables', () => {
      const invalid = URLBuilder.validatePathTemplate('/v1/models/{}');
      expect(invalid.isValid).toBe(false);
      expect(invalid.errors).toContain('Empty variable placeholder found');
    });
  });

  describe('URL Builder Instance', () => {
    test('should create URL builder instance', () => {
      const builder = URLBuilder.createBuilder('https://api.example.com');
      expect(builder.getBaseUrl()).toBe('https://api.example.com');
    });

    test('should build URLs using instance', () => {
      const builder = URLBuilder.createBuilder('https://api.example.com');
      const url = builder.build({
        type: 'chat' as const,
        method: 'POST' as const,
        path: '/v1/chat/completions'
      });
      expect(url).toBe('https://api.example.com/v1/chat/completions');
    });

    test('should validate base URL on instance creation', () => {
      expect(() => {
        URLBuilder.createBuilder('invalid-url');
      }).toThrow('Invalid base URL format');
    });
  });
});