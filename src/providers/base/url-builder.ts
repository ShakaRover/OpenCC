/**
 * Universal URL Builder
 * Handles URL construction for different API protocols and endpoint structures
 */

import type { APIEndpoint, URLBuildOptions } from './api-provider.interface.js';

/**
 * Universal URL Builder class
 * Provides intelligent URL construction for different API protocols
 */
export class URLBuilder {
  /**
   * Build a complete URL from base URL, endpoint template, and options
   */
  static buildURL(
    baseUrl: string,
    endpoint: APIEndpoint,
    options: URLBuildOptions = {}
  ): string {
    try {
      // Validate inputs
      this.validateInputs(baseUrl, endpoint, options);
      
      // Process path template with variables
      let processedPath = this.processPathTemplate(endpoint, options);
      
      // Normalize base URL and path
      const normalizedBaseUrl = this.normalizeBaseUrl(baseUrl);
      const normalizedPath = this.normalizePath(processedPath);
      
      // Construct base URL
      let fullUrl = `${normalizedBaseUrl}/${normalizedPath}`;
      
      // Add query parameters if provided
      if (options.queryParams && Object.keys(options.queryParams).length > 0) {
        const queryString = this.buildQueryString(options.queryParams);
        fullUrl += `?${queryString}`;
      }
      
      // Final validation
      this.validateURL(fullUrl);
      
      return fullUrl;
    } catch (error) {
      throw new Error(`Failed to build URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Process path template, replacing variables with actual values
   */
  private static processPathTemplate(
    endpoint: APIEndpoint, 
    options: URLBuildOptions
  ): string {
    let path = endpoint.path;
    
    // Handle path variables replacement
    if (endpoint.pathVariables && endpoint.pathVariables.length > 0) {
      for (const variable of endpoint.pathVariables) {
        const placeholder = `{${variable}}`;
        
        if (path.includes(placeholder)) {
          // Try to get value from pathParams first, then from model parameter
          let value = options.pathParams?.[variable];
          
          // Special handling for 'model' variable
          if (!value && variable === 'model' && options.model) {
            value = options.model;
          }
          
          if (value) {
            path = path.replace(placeholder, encodeURIComponent(value));
          } else if (endpoint.requiresModel) {
            throw new Error(`Required path variable '${variable}' not provided for endpoint: ${endpoint.path}`);
          }
        }
      }
    }
    
    // Validate that required model parameter is provided
    if (endpoint.requiresModel && !options.model) {
      // Check if model was already processed in path variables
      const hasModelInPath = endpoint.pathVariables?.includes('model') && 
                           !path.includes('{model}');
      
      if (!hasModelInPath) {
        throw new Error(`Endpoint requires model parameter: ${endpoint.path}`);
      }
    }
    
    // Check for unresolved variables
    const unresolvedVars = path.match(/\{[^}]+\}/g);
    if (unresolvedVars) {
      throw new Error(`Unresolved path variables: ${unresolvedVars.join(', ')} in path: ${path}`);
    }
    
    return path;
  }
  
  /**
   * Normalize base URL by removing trailing slashes
   */
  private static normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, '');
  }
  
  /**
   * Normalize path by removing leading slashes and multiple consecutive slashes
   */
  private static normalizePath(path: string): string {
    return path
      .replace(/^\/+/, '') // Remove leading slashes
      .replace(/\/+/g, '/'); // Replace multiple slashes with single slash
  }
  
  /**
   * Build query string from parameters object
   */
  private static buildQueryString(params: Record<string, string>): string {
    const searchParams = new URLSearchParams();
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value);
      }
    }
    
    return searchParams.toString();
  }
  
  /**
   * Validate inputs for URL building
   */
  private static validateInputs(
    baseUrl: string,
    endpoint: APIEndpoint,
    options: URLBuildOptions
  ): void {
    if (!baseUrl || typeof baseUrl !== 'string') {
      throw new Error('Base URL is required and must be a string');
    }
    
    if (!endpoint || !endpoint.path) {
      throw new Error('Endpoint with path is required');
    }
    
    if (typeof endpoint.path !== 'string') {
      throw new Error('Endpoint path must be a string');
    }
    
    // Validate base URL format
    try {
      new URL(baseUrl);
    } catch {
      throw new Error(`Invalid base URL format: ${baseUrl}`);
    }
  }
  
  /**
   * Validate final constructed URL
   */
  private static validateURL(url: string): void {
    try {
      const parsedUrl = new URL(url);
      
      // Additional validation can be added here
      if (!parsedUrl.protocol || (!parsedUrl.protocol.startsWith('http'))) {
        throw new Error('URL must use HTTP or HTTPS protocol');
      }
      
    } catch (error) {
      throw new Error(`Invalid constructed URL: ${url} - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Extract path variables from a path template
   */
  static extractPathVariables(pathTemplate: string): string[] {
    const matches = pathTemplate.match(/\{([^}]+)\}/g);
    if (!matches) return [];
    
    return matches.map(match => match.slice(1, -1)); // Remove { and }
  }
  
  /**
   * Check if a path template has variables
   */
  static hasPathVariables(pathTemplate: string): boolean {
    return /\{[^}]+\}/.test(pathTemplate);
  }
  
  /**
   * Validate a path template format
   */
  static validatePathTemplate(pathTemplate: string): { 
    isValid: boolean; 
    variables: string[]; 
    errors: string[] 
  } {
    const errors: string[] = [];
    
    if (!pathTemplate || typeof pathTemplate !== 'string') {
      errors.push('Path template must be a non-empty string');
      return { isValid: false, variables: [], errors };
    }
    
    // Check for malformed variables
    const variables = this.extractPathVariables(pathTemplate);
    const allBraces = pathTemplate.match(/[{}]/g) || [];
    
    if (allBraces.length % 2 !== 0) {
      errors.push('Mismatched braces in path template');
    }
    
    // Check for empty variables
    if (pathTemplate.includes('{}')) {
      errors.push('Empty variable placeholder found');
    }
    
    // Check for nested braces
    if (/\{[^}]*\{/.test(pathTemplate) || /\}[^{]*\}/.test(pathTemplate)) {
      errors.push('Nested or malformed braces detected');
    }
    
    return {
      isValid: errors.length === 0,
      variables,
      errors
    };
  }
  
  /**
   * Create a URL builder instance for specific base URL
   */
  static createBuilder(baseUrl: string): URLBuilderInstance {
    return new URLBuilderInstance(baseUrl);
  }
}

/**
 * URL Builder instance for reusing base URL
 */
export class URLBuilderInstance {
  constructor(private readonly baseUrl: string) {
    // Validate baseUrl format
    try {
      new URL(baseUrl);
    } catch {
      throw new Error(`Invalid base URL format: ${baseUrl}`);
    }
  }
  
  /**
   * Build URL using the instance's base URL
   */
  build(endpoint: APIEndpoint, options: URLBuildOptions = {}): string {
    return URLBuilder.buildURL(this.baseUrl, endpoint, options);
  }
  
  /**
   * Get the base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}