/**
 * QwenProvider Health Check Tests
 * Tests the Qwen-specific health check implementation
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { QwenProvider } from '../../src/providers/qwen/qwen-provider.js';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock QwenAuthProvider
jest.mock('../../src/providers/qwen/qwen-auth-provider.js', () => ({
  QwenAuthProvider: jest.fn().mockImplementation(() => ({
    getStatus: jest.fn(),
    getBaseUrl: jest.fn(),
    getAuthHeaders: jest.fn().mockResolvedValue({
      'Authorization': 'Bearer mock-token'
    }),
    isValid: jest.fn().mockResolvedValue(true),
    initialize: jest.fn().mockResolvedValue(undefined)
  }))
}));

// Mock QwenConfigProvider
jest.mock('../../src/providers/qwen/qwen-config-provider.js', () => ({
  QwenConfigProvider: jest.fn().mockImplementation(() => ({
    getBaseUrl: jest.fn().mockReturnValue('https://ai-qwen.com'),
    getApiKey: jest.fn().mockReturnValue(''),
    getTimeout: jest.fn().mockReturnValue(60000),
    getMaxRetries: jest.fn().mockReturnValue(3),
    getOptions: jest.fn().mockReturnValue({})
  }))
}));

// Mock logger
jest.mock('../../src/utils/helpers.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('QwenProvider Health Check', () => {
  let qwenProvider: QwenProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    qwenProvider = new QwenProvider();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return healthy when OAuth is valid and server is reachable', async () => {
    // Mock successful OAuth status
    const mockAuthProvider = qwenProvider['qwenAuthProvider'] as any;
    mockAuthProvider.getStatus.mockResolvedValue({
      isAuthenticated: true,
      expiresAt: Date.now() + 3600000
    });
    mockAuthProvider.getBaseUrl.mockResolvedValue('https://ai-qwen.com');

    // Mock successful HEAD request
    mockFetch.mockResolvedValue({
      status: 200,
      statusText: 'OK'
    } as Response);

    const result = await qwenProvider.testConnection();

    expect(result.isHealthy).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.responseTime).toBeGreaterThan(0);
    expect(result.details?.reason).toBe('OAuth valid and server reachable');
  });

  test('should return unhealthy when OAuth credentials are invalid', async () => {
    // Mock invalid OAuth status
    const mockAuthProvider = qwenProvider['qwenAuthProvider'] as any;
    mockAuthProvider.getStatus.mockResolvedValue({
      isAuthenticated: false,
      error: 'Token expired'
    });

    const result = await qwenProvider.testConnection();

    expect(result.isHealthy).toBe(false);
    expect(result.error).toBe('Qwen OAuth credentials are not valid');
    expect(result.details?.reason).toBe('OAuth authentication failed');
    
    // Should not make any HTTP requests if OAuth fails
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('should return unhealthy when base URL retrieval fails', async () => {
    // Mock valid OAuth but failed base URL retrieval
    const mockAuthProvider = qwenProvider['qwenAuthProvider'] as any;
    mockAuthProvider.getStatus.mockResolvedValue({
      isAuthenticated: true,
      expiresAt: Date.now() + 3600000
    });
    mockAuthProvider.getBaseUrl.mockRejectedValue(new Error('Failed to get base URL'));

    const result = await qwenProvider.testConnection();

    expect(result.isHealthy).toBe(false);
    expect(result.error).toBe('Failed to get Qwen base URL');
    expect(result.details?.reason).toBe('Base URL retrieval failed');
  });

  test('should return unhealthy when server returns 5xx error', async () => {
    // Mock valid OAuth
    const mockAuthProvider = qwenProvider['qwenAuthProvider'] as any;
    mockAuthProvider.getStatus.mockResolvedValue({
      isAuthenticated: true,
      expiresAt: Date.now() + 3600000
    });
    mockAuthProvider.getBaseUrl.mockResolvedValue('https://ai-qwen.com');

    // Mock server error
    mockFetch.mockResolvedValue({
      status: 500,
      statusText: 'Internal Server Error'
    } as Response);

    const result = await qwenProvider.testConnection();

    expect(result.isHealthy).toBe(false);
    expect(result.error).toBe('Qwen API server error: 500 Internal Server Error');
    expect(result.details?.httpStatus).toBe(500);
    expect(result.details?.reason).toBe('Server error response');
  });

  test('should return healthy when server returns 4xx error (client error is acceptable)', async () => {
    // Mock valid OAuth
    const mockAuthProvider = qwenProvider['qwenAuthProvider'] as any;
    mockAuthProvider.getStatus.mockResolvedValue({
      isAuthenticated: true,
      expiresAt: Date.now() + 3600000
    });
    mockAuthProvider.getBaseUrl.mockResolvedValue('https://ai-qwen.com');

    // Mock 404 (server is reachable, just endpoint not found)
    mockFetch.mockResolvedValue({
      status: 404,
      statusText: 'Not Found'
    } as Response);

    const result = await qwenProvider.testConnection();

    expect(result.isHealthy).toBe(true);
    expect(result.details?.reason).toBe('OAuth valid and server reachable');
  });

  test('should return unhealthy when network request fails', async () => {
    // Mock valid OAuth
    const mockAuthProvider = qwenProvider['qwenAuthProvider'] as any;
    mockAuthProvider.getStatus.mockResolvedValue({
      isAuthenticated: true,
      expiresAt: Date.now() + 3600000
    });
    mockAuthProvider.getBaseUrl.mockResolvedValue('https://ai-qwen.com');

    // Mock network error
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await qwenProvider.testConnection();

    expect(result.isHealthy).toBe(false);
    expect(result.error).toContain('Qwen API connectivity test failed: Network error');
    expect(result.details?.reason).toBe('Network connectivity failed');
  });

  test('should handle unexpected errors gracefully', async () => {
    // Mock OAuth status to throw unexpected error
    const mockAuthProvider = qwenProvider['qwenAuthProvider'] as any;
    mockAuthProvider.getStatus.mockRejectedValue(new Error('Unexpected error'));

    const result = await qwenProvider.testConnection();

    expect(result.isHealthy).toBe(false);
    expect(result.error).toContain('Qwen health check failed: Unexpected error');
    expect(result.details?.reason).toBe('Unexpected error during health check');
  });
});

describe('QwenProvider getModels', () => {
  let qwenProvider: QwenProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    qwenProvider = new QwenProvider();
  });

  test('should return predefined Qwen models', async () => {
    const result = await qwenProvider.getModels();

    expect(result.object).toBe('list');
    expect(result.data).toHaveLength(1);
    expect(result.data.map(m => m.id)).toEqual([
      'qwen3-coder-plus'
    ]);

    // Check model structure
    result.data.forEach(model => {
      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('object', 'model');
      expect(model).toHaveProperty('owned_by', 'qwen');
      expect(model.created).toBeGreaterThan(0);
    });
  });
});