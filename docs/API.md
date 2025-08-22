# OpenClaude API 文档

## 📋 API 概览

OpenClaude 提供完全兼容 Anthropic Claude API 的 RESTful 接口，自动将请求转换为 OpenAI 格式处理。

### Base URL

```
http://localhost:3000
```

### 认证

使用 `x-api-key` 请求头进行认证：

```http
x-api-key: your-api-key-here
```

### Content-Type

所有请求必须使用 JSON 格式：

```http
Content-Type: application/json
```

## 🔗 端点详情

### 1. 创建消息 (Messages)

与 Claude 进行对话的主要端点。

#### 端点

```http
POST /v1/messages
```

#### 请求体

```json
{
  "model": "claude-3-opus-20240229",
  "max_tokens": 1024,
  "messages": [
    {
      "role": "user",
      "content": "Hello, Claude!"
    }
  ],
  "system": "You are a helpful assistant.",
  "temperature": 0.7,
  "top_p": 0.9,
  "top_k": 40,
  "stream": false,
  "stop_sequences": ["\\n\\nHuman:", "\\n\\nAssistant:"],
  "anthropic_version": "bedrock-2023-05-31",
  "metadata": {
    "user_id": "user_123"
  }
}
```

#### 参数说明

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `model` | string | ✅ | 使用的模型名称 |
| `max_tokens` | integer | ✅ | 最大生成令牌数 (1-4096) |
| `messages` | array | ✅ | 对话消息数组 |
| `system` | string | ❌ | 系统提示词 |
| `temperature` | number | ❌ | 随机性控制 (0.0-1.0) |
| `top_p` | number | ❌ | 核采样参数 (0.0-1.0) |
| `top_k` | integer | ❌ | Top-k 采样参数 |
| `stream` | boolean | ❌ | 是否启用流式响应 |
| `stop_sequences` | array | ❌ | 停止序列 |
| `anthropic_version` | string | ❌ | API 版本 |
| `metadata` | object | ❌ | 请求元数据 |

#### 消息格式

```json
{
  "role": "user|assistant",
  "content": "文本内容" 
}
```

或包含多种内容类型：

```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "Look at this image:"
    },
    {
      "type": "image",
      "source": {
        "type": "base64",
        "media_type": "image/jpeg",
        "data": "base64_encoded_image_data"
      }
    }
  ]
}
```

#### 成功响应 (200)

```json
{
  "id": "msg_01234567890abcdef",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! How can I help you today?"
    }
  ],
  "model": "claude-3-opus-20240229",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 10,
    "output_tokens": 8
  }
}
```

#### 工具使用示例

请求：
```json
{
  "model": "claude-3-opus-20240229",
  "max_tokens": 200,
  "messages": [
    {
      "role": "user",
      "content": "What's the weather like in Tokyo?"
    }
  ],
  "tools": [
    {
      "name": "get_weather",
      "description": "Get current weather for a location",
      "input_schema": {
        "type": "object",
        "properties": {
          "location": {
            "type": "string",
            "description": "City name"
          },
          "unit": {
            "type": "string",
            "enum": ["celsius", "fahrenheit"],
            "description": "Temperature unit"
          }
        },
        "required": ["location"]
      }
    }
  ],
  "tool_choice": {"type": "auto"}
}
```

响应：
```json
{
  "id": "msg_01234567890abcdef",
  "type": "message", 
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "I'll check the weather in Tokyo for you."
    },
    {
      "type": "tool_use",
      "id": "toolu_01234567890abcdef",
      "name": "get_weather",
      "input": {
        "location": "Tokyo",
        "unit": "celsius"
      }
    }
  ],
  "model": "claude-3-opus-20240229",
  "stop_reason": "tool_use",
  "usage": {
    "input_tokens": 150,
    "output_tokens": 45
  }
}
```

#### 流式响应

设置 `"stream": true` 启用流式响应：

```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

流式数据格式：

```
data: {"type": "message_start", "message": {...}}

data: {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}

data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Hello"}}

data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": " there!"}}

data: {"type": "content_block_stop", "index": 0}

data: {"type": "message_delta", "delta": {"stop_reason": "end_turn", "usage": {"output_tokens": 8}}}

data: {"type": "message_stop"}

data: [DONE]
```

### 2. 获取模型列表

获取所有可用模型的列表。

#### 端点

```http
GET /v1/models
```

#### 成功响应 (200)

```json
{
  "object": "list",
  "data": [
    {
      "id": "claude-3-opus-20240229",
      "object": "model",
      "created": 1677610602,
      "owned_by": "anthropic",
      "capabilities": ["text", "images", "tools", "reasoning"],
      "context_length": 200000,
      "max_tokens": 4096
    },
    {
      "id": "claude-3-sonnet-20240229", 
      "object": "model",
      "created": 1677610602,
      "owned_by": "anthropic",
      "capabilities": ["text", "images", "tools", "balanced"],
      "context_length": 200000,
      "max_tokens": 4096
    }
  ]
}
```

### 3. 获取特定模型信息

获取单个模型的详细信息。

#### 端点

```http
GET /v1/models/{model_id}
```

#### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `model_id` | string | 模型标识符 |

#### 成功响应 (200)

```json
{
  "id": "claude-3-opus-20240229",
  "object": "model",
  "created": 1677610602,
  "owned_by": "anthropic",
  "capabilities": ["text", "images", "tools", "reasoning"],
  "context_length": 200000,
  "max_tokens": 4096,
  "mapped_to": {
    "openai_model": "gpt-4-turbo-preview",
    "description": "Maps to OpenAI gpt-4-turbo-preview"
  }
}
```

### 4. 健康检查

检查服务状态和健康度。

#### 端点

```http
GET /health
```

#### 成功响应 (200)

```json
{
  "status": "healthy",
  "timestamp": 1703123456789,
  "version": "1.0.0",
  "uptime": 3600,
  "services": {
    "openai": {
      "status": "up",
      "responseTime": 150
    }
  },
  "memory": {
    "used": 157286400,
    "total": 268435456,
    "percentage": 58
  }
}
```

#### 详细健康信息

```http
GET /health/detailed
```

```json
{
  "status": "healthy",
  "timestamp": 1703123456789,
  "version": "1.0.0",
  "uptime": 3600,
  "environment": {
    "nodeVersion": "v18.17.0",
    "platform": "linux",
    "nodeEnv": "production"
  },
  "services": {
    "openai": {
      "status": "up", 
      "responseTime": 150
    }
  },
  "memory": {
    "used": 157286400,
    "total": 268435456,
    "percentage": 58,
    "rss": 201326592,
    "external": 12582912
  },
  "metrics": {
    "activeRequests": 3,
    "totalRequests": 1250,
    "recentRequests": [...]
  },
  "configuration": {
    "features": {
      "enableAudioSupport": false,
      "enableFileSupport": false,
      "enablePromptCaching": false,
      "enableMetrics": true
    },
    "supportedModels": [
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229"
    ]
  }
}
```

#### 指标信息

```http
GET /health/metrics
```

```json
{
  "summary": {
    "totalRequests": 1250,
    "successfulRequests": 1180,
    "errorRequests": 70,
    "pendingRequests": 0,
    "successRate": "94.40",
    "averageDuration": 245,
    "totalTokens": 1250000
  },
  "requests": [
    {
      "requestId": "req_123",
      "startTime": 1703123456789,
      "endTime": 1703123457034,
      "duration": 245,
      "model": "claude-3-opus-20240229",
      "status": "success",
      "inputTokens": 50,
      "outputTokens": 120
    }
  ]
}
```

## ❌ 错误响应

### 错误格式

所有错误都使用统一的格式：

```json
{
  "type": "error",
  "error": {
    "type": "error_type",
    "message": "Human readable error message"
  }
}
```

### 错误类型

| HTTP 状态码 | 错误类型 | 说明 |
|------------|----------|------|
| 400 | `invalid_request_error` | 请求参数无效或缺失 |
| 401 | `authentication_error` | 认证失败或API密钥无效 |
| 404 | `invalid_request_error` | 请求的资源不存在 |
| 429 | `rate_limit_error` | 请求频率超过限制 |
| 500 | `api_error` | 服务器内部错误 |

### 错误示例

#### 认证错误 (401)

```json
{
  "type": "error",
  "error": {
    "type": "authentication_error",
    "message": "Missing API key. Please provide a valid API key in the x-api-key header."
  }
}
```

#### 无效请求 (400)

```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error", 
    "message": "Missing required parameter: max_tokens"
  }
}
```

#### 不支持的功能 (400)

```json
{
  "type": "error",
  "error": {
    "type": "not_supported_error",
    "message": "音频输入功能暂不支持，请使用纯文本输入"
  }
}
```

#### 速率限制 (429)

```json
{
  "type": "error",
  "error": {
    "type": "rate_limit_error",
    "message": "Rate limit exceeded. Please slow down your requests."
  }
}
```

## 📊 使用限制

### 速率限制

| 端点 | 限制 | 窗口期 |
|------|------|--------|
| `/v1/messages` | 100 请求 | 15 分钟 |
| `/v1/models` | 100 请求 | 15 分钟 |
| `/health/*` | 60 请求 | 1 分钟 |

速率限制信息通过响应头返回：

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1703124456
```

### 请求限制

- 最大请求体大小: 10MB
- 最大令牌数: 4096
- 请求超时: 60秒
- 最大消息数: 1000条

## 🌐 支持的模型

| Anthropic 模型 | 映射的 OpenAI 模型 | 上下文长度 | 能力特点 |
|----------------|-------------------|------------|----------|
| `claude-3-opus-20240229` | `gpt-4-turbo-preview` | 200K → 128K | 最强推理能力 |
| `claude-opus-4-20250514` | `gpt-4-turbo-preview` | 200K → 128K | 最新版本 |
| `claude-3-sonnet-20240229` | `gpt-4` | 200K → 8K | 平衡性能 |
| `claude-3-haiku-20240307` | `gpt-3.5-turbo` | 200K → 16K | 快速响应 |
| `claude-instant-1.2` | `gpt-3.5-turbo` | 100K → 16K | 轻量级处理 |

## 🔧 客户端示例

### cURL

```bash
# 基础消息请求
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "model": "claude-3-opus-20240229",
    "max_tokens": 100,
    "messages": [
      {
        "role": "user", 
        "content": "Hello!"
      }
    ]
  }'

# 流式请求
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "model": "claude-3-opus-20240229",
    "max_tokens": 100,
    "stream": true,
    "messages": [
      {
        "role": "user",
        "content": "Tell me a story"
      }
    ]
  }'
```

### JavaScript/Node.js

```javascript
const axios = require('axios');

async function sendMessage() {
  try {
    const response = await axios.post('http://localhost:3000/v1/messages', {
      model: 'claude-3-opus-20240229',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: 'Hello, Claude!'
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'your-api-key'
      }
    });

    console.log(response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

sendMessage();
```

### Python

```python
import requests
import json

def send_message():
    url = "http://localhost:3000/v1/messages"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": "your-api-key"
    }
    data = {
        "model": "claude-3-opus-20240229",
        "max_tokens": 100,
        "messages": [
            {
                "role": "user",
                "content": "Hello, Claude!"
            }
        ]
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        return None

result = send_message()
if result:
    print(json.dumps(result, indent=2))
```

### 流式处理示例

```javascript
// Node.js 流式处理
const https = require('https');

function streamMessages() {
  const postData = JSON.stringify({
    model: 'claude-3-opus-20240229',
    max_tokens: 200,
    stream: true,
    messages: [
      {
        role: 'user',
        content: 'Write a short poem'
      }
    ]
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'your-api-key',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    res.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data === '[DONE]') {
            console.log('Stream finished');
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta') {
              process.stdout.write(parsed.delta.text || '');
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.write(postData);
  req.end();
}

streamMessages();
```

## 🔗 相关资源

- [Anthropic Claude API 文档](https://docs.anthropic.com/claude/reference/)
- [OpenAI API 文档](https://platform.openai.com/docs/api-reference)
- [OpenClaude 开发者文档](DEVELOPMENT.md)
- [部署指南](DEPLOYMENT.md)