/**
 * OpenCC 协议转换器 - 简化演示版本
 * 
 * 这是一个简化的演示版本，展示了核心转换逻辑
 * 完整的TypeScript版本在src/目录中
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 模型映射配置
const MODEL_MAPPING = {
  'claude-3-opus-20240229': {
    openaiModel: 'gpt-4-turbo-preview',
    contextLength: 128000,
    maxTokens: 4096,
    capabilities: ['text', 'images', 'tools', 'reasoning']
  },
  'claude-3-sonnet-20240229': {
    openaiModel: 'gpt-4',
    contextLength: 8192,
    maxTokens: 4096,
    capabilities: ['text', 'images', 'tools', 'balanced']
  },
  'claude-3-haiku-20240307': {
    openaiModel: 'gpt-3.5-turbo',
    contextLength: 16384,
    maxTokens: 4096,
    capabilities: ['text', 'images', 'speed']
  }
};

// 工具函数
function generateMessageId() {
  return `msg_${Math.random().toString(36).substring(2, 15)}`;
}

function flattenContent(content) {
  if (typeof content === 'string') {
    return content;
  }
  
  if (Array.isArray(content)) {
    return content
      .filter(item => item.type === 'text')
      .map(item => item.text || '')
      .join('\n');
  }
  
  return '';
}

// 检查不支持的内容
function hasUnsupportedContent(content) {
  if (!Array.isArray(content)) {
    return { hasUnsupported: false, unsupportedTypes: [] };
  }
  
  const unsupportedTypes = content
    .map(item => item.type)
    .filter(type => ['input_audio', 'file'].includes(type));
    
  return {
    hasUnsupported: unsupportedTypes.length > 0,
    unsupportedTypes: [...new Set(unsupportedTypes)]
  };
}

// Anthropic到OpenAI请求转换
function convertAnthropicToOpenAI(anthropicRequest) {
  // 验证必需参数
  if (!anthropicRequest.model) {
    throw new Error('Missing required parameter: model');
  }
  
  if (!anthropicRequest.max_tokens || anthropicRequest.max_tokens <= 0) {
    throw new Error('Missing or invalid required parameter: max_tokens');
  }
  
  if (!anthropicRequest.messages || anthropicRequest.messages.length === 0) {
    throw new Error('Missing or empty required parameter: messages');
  }
  
  // 检查模型支持
  const modelMapping = MODEL_MAPPING[anthropicRequest.model];
  if (!modelMapping) {
    throw new Error(`Unsupported model: ${anthropicRequest.model}`);
  }
  
  // 检查不支持的内容
  for (const message of anthropicRequest.messages) {
    if (Array.isArray(message.content)) {
      const { hasUnsupported, unsupportedTypes } = hasUnsupportedContent(message.content);
      if (hasUnsupported) {
        const typeMessage = unsupportedTypes.includes('input_audio') ? 
          '音频输入功能暂不支持，请使用纯文本输入' :
          '文件上传功能暂不支持，请将文件内容转换为文本后输入';
        throw new Error(typeMessage);
      }
    }
  }
  
  // 构建OpenAI请求
  const openaiMessages = [];
  
  // 添加系统消息
  if (anthropicRequest.system) {
    openaiMessages.push({
      role: 'system',
      content: anthropicRequest.system
    });
  }
  
  // 转换消息
  for (const message of anthropicRequest.messages) {
    openaiMessages.push({
      role: message.role,
      content: flattenContent(message.content)
    });
  }
  
  return {
    model: modelMapping.openaiModel,
    messages: openaiMessages,
    max_tokens: Math.min(anthropicRequest.max_tokens, modelMapping.maxTokens),
    temperature: anthropicRequest.temperature,
    top_p: anthropicRequest.top_p,
    stream: anthropicRequest.stream
  };
}

// OpenAI到Anthropic响应转换
function convertOpenAIToAnthropic(openaiResponse, originalModel) {
  const choice = openaiResponse.choices[0];
  if (!choice) {
    throw new Error('No choices in OpenAI response');
  }
  
  // 转换停止原因
  const stopReasonMap = {
    'stop': 'end_turn',
    'length': 'max_tokens',
    'tool_calls': 'tool_use',
    'content_filter': 'end_turn'
  };
  
  return {
    id: generateMessageId(),
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: choice.message.content || ''
      }
    ],
    model: originalModel,
    stop_reason: stopReasonMap[choice.finish_reason] || 'end_turn',
    usage: {
      input_tokens: openaiResponse.usage.prompt_tokens,
      output_tokens: openaiResponse.usage.completion_tokens
    }
  };
}

// 路由定义

// 根端点
app.get('/', (req, res) => {
  res.json({
    name: 'OpenCC Protocol Converter',
    version: '1.0.0',
    description: 'Anthropic Claude API to OpenAI API protocol converter',
    status: 'online',
    endpoints: {
      messages: '/v1/messages',
      models: '/v1/models',
      health: '/health'
    },
    note: 'This is a demo version. Full TypeScript implementation is in src/ directory.'
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    version: '1.0.0-demo',
    uptime: process.uptime(),
    memory: {
      used: process.memoryUsage().heapUsed,
      total: process.memoryUsage().heapTotal,
      percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
    }
  });
});

// 模型列表
app.get('/v1/models', (req, res) => {
  const models = Object.entries(MODEL_MAPPING).map(([id, mapping]) => ({
    id,
    object: 'model',
    created: 1677610602,
    owned_by: 'anthropic',
    capabilities: mapping.capabilities,
    context_length: mapping.contextLength,
    max_tokens: mapping.maxTokens,
    mapped_to: mapping.openaiModel
  }));
  
  res.json({
    object: 'list',
    data: models
  });
});

// 消息处理（演示版本）
app.post('/v1/messages', (req, res) => {
  try {
    // 简单的认证检查
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey.length < 10) {
      return res.status(401).json({
        type: 'error',
        error: {
          type: 'authentication_error',
          message: 'Missing or invalid API key. Please provide a valid API key in the x-api-key header.'
        }
      });
    }
    
    // 转换请求
    const openaiRequest = convertAnthropicToOpenAI(req.body);
    
    // 模拟OpenAI响应（实际版本会调用真实的OpenAI API）
    const mockOpenAIResponse = {
      id: 'chatcmpl-demo123',
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: openaiRequest.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `Hello! This is a demo response converted from ${req.body.model} to ${openaiRequest.model}. Your message was: "${openaiRequest.messages[openaiRequest.messages.length - 1].content}"`
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 30,
        total_tokens: 50
      }
    };
    
    // 转换响应
    const anthropicResponse = convertOpenAIToAnthropic(mockOpenAIResponse, req.body.model);
    
    res.json(anthropicResponse);
    
  } catch (error) {
    let errorType = 'api_error';
    let statusCode = 500;
    
    if (error.message.includes('Missing') || error.message.includes('invalid') || error.message.includes('Unsupported')) {
      errorType = 'invalid_request_error';
      statusCode = 400;
    } else if (error.message.includes('支持')) {
      errorType = 'not_supported_error';
      statusCode = 400;
    }
    
    res.status(statusCode).json({
      type: 'error',
      error: {
        type: errorType,
        message: error.message
      }
    });
  }
});

// 错误处理
app.use((req, res) => {
  res.status(404).json({
    type: 'error',
    error: {
      type: 'invalid_request_error',
      message: `Not found: ${req.method} ${req.path}`
    }
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log('🚀 OpenCC Protocol Converter (Demo Version) is running!');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log('📚 API Endpoints:');
  console.log(`  - Messages: http://localhost:${PORT}/v1/messages`);
  console.log(`  - Models: http://localhost:${PORT}/v1/models`);
  console.log(`  - Health: http://localhost:${PORT}/health`);
  console.log('');
  console.log('📖 Usage Example:');
  console.log(`curl -X POST http://localhost:${PORT}/v1/messages \\`);
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -H "x-api-key: demo-api-key-12345" \\');
  console.log('  -d \'{"model": "claude-3-opus-20240229", "max_tokens": 100, "messages": [{"role": "user", "content": "Hello!"}]}\'');
  console.log('');
  console.log(`🤖 Supported Models (${Object.keys(MODEL_MAPPING).length}):`);
  Object.entries(MODEL_MAPPING).forEach(([model, mapping]) => {
    console.log(`  - ${model} → ${mapping.openaiModel}`);
  });
  console.log('');
  console.log('✨ Ready to convert Anthropic requests to OpenAI format!');
  console.log('');
  console.log('⚠️  Note: This is a demo version with mocked responses.');
  console.log('   The full TypeScript implementation is in the src/ directory.');
});