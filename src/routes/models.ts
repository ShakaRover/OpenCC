/**
 * Models Route Handler
 * Handles /v1/models endpoint for listing available models
 */

import { Router, Request, Response } from 'express';
import type { AnthropicError } from '@/types/index.js';
import { ConversionService } from '@/services/index.js';
import { configManager } from '@/config/index.js';

export function createModelsRouter(conversionService: ConversionService): Router {
  const router = Router();

  /**
   * GET /v1/models
   * List all available models in Anthropic format
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const supportedModels = await conversionService.getSupportedModels();
      const modelMapping = configManager.getModelMapping();

      const models = supportedModels.models.map(modelId => {
        const mapping = modelMapping[modelId];
        return {
          id: modelId,
          object: 'model',
          created: 1677610602, // Fixed timestamp for consistency
          owned_by: 'anthropic',
          capabilities: mapping?.capabilities || [],
          context_length: mapping?.contextLength || 200000,
          max_tokens: mapping?.maxTokens || 4096
        };
      });

      const response = {
        object: 'list',
        data: models
      };

      res.json(response);

    } catch (error) {
      console.error('Models route error:', error);
      
      const anthropicError: AnthropicError = {
        type: 'error',
        error: {
          type: 'api_error',
          message: error instanceof Error ? error.message : 'Failed to fetch models'
        }
      };

      res.status(500).json(anthropicError);
    }
  });

  /**
   * GET /v1/models/:model_id
   * Get specific model information
   */
  router.get('/:model_id', async (req: Request, res: Response) => {
    try {
      const modelId = req.params.model_id;
      const modelMapping = configManager.getModelMapping();
      const mapping = modelMapping[modelId];

      if (!mapping) {
        const anthropicError: AnthropicError = {
          type: 'error',
          error: {
            type: 'invalid_request_error',
            message: `Model '${modelId}' not found`
          }
        };

        return res.status(404).json(anthropicError);
      }

      const modelInfo = {
        id: modelId,
        object: 'model',
        created: 1677610602,
        owned_by: 'anthropic',
        capabilities: mapping.capabilities || [],
        context_length: mapping.contextLength || 200000,
        max_tokens: mapping.maxTokens || 4096,
        mapped_to: {
          openai_model: mapping.openaiModel,
          description: `Maps to OpenAI ${mapping.openaiModel}`
        }
      };

      res.json(modelInfo);

    } catch (error) {
      console.error('Model info route error:', error);
      
      const anthropicError: AnthropicError = {
        type: 'error',
        error: {
          type: 'api_error',
          message: error instanceof Error ? error.message : 'Failed to fetch model info'
        }
      };

      res.status(500).json(anthropicError);
    }
  });

  return router;
}