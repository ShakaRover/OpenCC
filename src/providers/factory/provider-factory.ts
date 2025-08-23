/**
 * Provider Factory
 * Creates and manages API provider instances based on configuration mode
 */

import { logger } from '../../utils/helpers.js';
import { configManager } from '../../config/index.js';
import { ConfigMode } from '../../types/common.js';
import { QwenProvider } from '../qwen/index.js';
import { OpenAIProvider } from '../openai/index.js';
import type { APIProvider } from '../base/index.js';
import { ProtocolType } from '../base/index.js';

/**
 * Provider Factory interface
 */
export interface IProviderFactory {
  createProvider(mode: ConfigMode): Promise<APIProvider>;
  getAvailableProviders(): ConfigMode[];
  getSupportedProtocols(): ProtocolType[];
  isProviderSupported(mode: ConfigMode): boolean;
}

/**
 * Provider Factory Implementation
 * Manages creation and lifecycle of API providers
 */
export class ProviderFactory implements IProviderFactory {
  private static instance: ProviderFactory;
  private readonly providerRegistry = new Map<ConfigMode, () => Promise<APIProvider>>();
  private readonly providerCache = new Map<ConfigMode, APIProvider>();
  
  constructor() {
    this.registerProviders();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): ProviderFactory {
    if (!ProviderFactory.instance) {
      ProviderFactory.instance = new ProviderFactory();
    }
    return ProviderFactory.instance;
  }
  
  /**
   * Register all available providers
   */
  private registerProviders(): void {
    // Register Qwen provider
    this.providerRegistry.set(ConfigMode.QWEN_CLI, async () => {
      logger.debug('Creating Qwen provider instance');
      const provider = new QwenProvider();
      await provider.initialize();
      return provider;
    });
    
    // Register Universal OpenAI provider
    this.providerRegistry.set(ConfigMode.UNIVERSAL_OPENAI, async () => {
      logger.debug('Creating OpenAI provider instance');
      
      const config = configManager.getConfig();
      const apiKey = config.openai.apiKey;
      const baseUrl = config.openai.baseUrl;
      
      if (!apiKey) {
        throw new Error('OpenAI API key is required for Universal OpenAI mode');
      }
      
      const provider = new OpenAIProvider(apiKey, baseUrl);
      await provider.initialize();
      return provider;
    });
    
    logger.info('Provider factory initialized', {
      registeredProviders: Array.from(this.providerRegistry.keys()),
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Create provider instance for specified mode
   */
  async createProvider(mode: ConfigMode): Promise<APIProvider> {
    try {
      logger.debug('Creating provider for mode', { mode });
      
      // Check if provider is cached and still valid
      const cachedProvider = this.providerCache.get(mode);
      if (cachedProvider) {
        const healthStatus = await cachedProvider.testConnection();
        if (healthStatus.isHealthy) {
          logger.debug('Using cached provider', { 
            mode, 
            provider: cachedProvider.name,
            responseTime: healthStatus.responseTime
          });
          return cachedProvider;
        } else {
          logger.warn('Cached provider is unhealthy, creating new instance', {
            mode,
            provider: cachedProvider.name,
            error: healthStatus.error
          });
          this.providerCache.delete(mode);
        }
      }
      
      // Get provider factory function
      const providerFactory = this.providerRegistry.get(mode);
      if (!providerFactory) {
        throw new Error(`No provider registered for config mode: ${mode}`);
      }
      
      // Create new provider instance
      const provider = await providerFactory();
      
      // Cache the provider
      this.providerCache.set(mode, provider);
      
      logger.info('Provider created successfully', {
        mode,
        providerName: provider.name,
        protocol: provider.protocol,
        version: provider.version,
        baseUrl: provider.baseUrl
      });
      
      return provider;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create provider', {
        mode,
        error: errorMessage
      });
      
      // Remove any cached instance on error
      this.providerCache.delete(mode);
      
      throw new Error(`Failed to create provider for mode '${mode}': ${errorMessage}`);
    }
  }
  
  /**
   * Get list of available provider modes
   */
  getAvailableProviders(): ConfigMode[] {
    return Array.from(this.providerRegistry.keys());
  }
  
  /**
   * Get list of supported protocols
   */
  getSupportedProtocols(): ProtocolType[] {
    const protocols = new Set<ProtocolType>();
    
    // Manually define known protocols for registered providers
    // This could be enhanced to dynamically query providers
    if (this.providerRegistry.has(ConfigMode.QWEN_CLI)) {
      protocols.add(ProtocolType.OPENAI); // Qwen uses OpenAI protocol
    }
    
    if (this.providerRegistry.has(ConfigMode.UNIVERSAL_OPENAI)) {
      protocols.add(ProtocolType.OPENAI);
    }
    
    return Array.from(protocols);
  }
  
  /**
   * Check if a provider mode is supported
   */
  isProviderSupported(mode: ConfigMode): boolean {
    return this.providerRegistry.has(mode);
  }
  
  /**
   * Register a custom provider factory
   */
  registerProvider(mode: ConfigMode, factory: () => Promise<APIProvider>): void {
    logger.info('Registering custom provider', { mode });
    this.providerRegistry.set(mode, factory);
  }
  
  /**
   * Unregister a provider
   */
  unregisterProvider(mode: ConfigMode): void {
    logger.info('Unregistering provider', { mode });
    
    // Dispose cached provider if exists
    const cachedProvider = this.providerCache.get(mode);
    if (cachedProvider && cachedProvider.dispose) {
      cachedProvider.dispose().catch(error => {
        logger.warn('Error disposing provider', {
          mode,
          provider: cachedProvider.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });
    }
    
    this.providerRegistry.delete(mode);
    this.providerCache.delete(mode);
  }
  
  /**
   * Clear provider cache
   */
  async clearCache(): Promise<void> {
    logger.info('Clearing provider cache');
    
    // Dispose all cached providers
    const disposePromises = Array.from(this.providerCache.entries()).map(async ([mode, provider]) => {
      try {
        if (provider.dispose) {
          await provider.dispose();
        }
      } catch (error) {
        logger.warn('Error disposing cached provider', {
          mode,
          provider: provider.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    await Promise.allSettled(disposePromises);
    this.providerCache.clear();
  }
  
  /**
   * Get cached provider (if exists and healthy)
   */
  async getCachedProvider(mode: ConfigMode): Promise<APIProvider | null> {
    const cachedProvider = this.providerCache.get(mode);
    if (!cachedProvider) {
      return null;
    }
    
    try {
      const healthStatus = await cachedProvider.testConnection();
      if (healthStatus.isHealthy) {
        return cachedProvider;
      } else {
        logger.debug('Cached provider is unhealthy', {
          mode,
          provider: cachedProvider.name,
          error: healthStatus.error
        });
        this.providerCache.delete(mode);
        return null;
      }
    } catch (error) {
      logger.warn('Error checking cached provider health', {
        mode,
        provider: cachedProvider.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.providerCache.delete(mode);
      return null;
    }
  }
  
  /**
   * Get provider statistics
   */
  getProviderStats(): {
    registered: number;
    cached: number;
    modes: ConfigMode[];
    protocols: ProtocolType[];
  } {
    return {
      registered: this.providerRegistry.size,
      cached: this.providerCache.size,
      modes: this.getAvailableProviders(),
      protocols: this.getSupportedProtocols()
    };
  }
  
  /**
   * Test all registered providers
   */
  async testAllProviders(): Promise<Record<ConfigMode, { 
    success: boolean; 
    provider?: string; 
    error?: string; 
    responseTime?: number; 
  }>> {
    const results: Record<string, any> = {};
    
    const testPromises = Array.from(this.providerRegistry.keys()).map(async (mode) => {
      try {
        const provider = await this.createProvider(mode);
        const healthStatus = await provider.testConnection();
        
        results[mode] = {
          success: healthStatus.isHealthy,
          provider: provider.name,
          error: healthStatus.error,
          responseTime: healthStatus.responseTime
        };
      } catch (error) {
        results[mode] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    await Promise.allSettled(testPromises);
    return results;
  }
}

// Export singleton instance
export const providerFactory = ProviderFactory.getInstance();