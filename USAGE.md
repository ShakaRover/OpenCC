# Qwen API代理服务使用说明

## 概述

本服务是一个API代理，将Claude Code客户端的Anthropic API调用转换为Qwen AI的OpenAI兼容API调用。通过OAuth2认证机制连接Qwen服务，实现seamless的AI模型切换。

## 前置条件

1. **Node.js**: 需要Node.js 18或更高版本
2. **Qwen OAuth凭证**: 需要有效的`~/.qwen/oauth_creds.json`文件

### 获取Qwen OAuth凭证

确保你已经配置了Qwen的OAuth凭证文件：`~/.qwen/oauth_creds.json`

文件格式：
```json
{
  "access_token": "your_access_token",
  "refresh_token": "your_refresh_token", 
  "expiry_date": 1704067200000,
  "resource_url": "portal.qwen.ai"
}
```

## 安装和启动

1. **安装依赖**：
   ```bash
   npm install
   ```

2. **开发模式启动**：
   ```bash
   npm run dev
   ```

3. **生产模式启动**：
   ```bash
   npm run build
   npm start
   ```

## 服务配置

### 环境变量

- `PORT`: 服务监听端口（默认：26666）
- `HOST`: 服务监听地址（默认：localhost）
- `NODE_ENV`: 运行环境（development/production）
- `LOG_LEVEL`: 日志级别（debug/info/warn/error）
- `QWEN_OAUTH_CREDS_PATH`: OAuth凭证文件路径（默认：~/.qwen/oauth_creds.json）

### 示例配置
```bash
export PORT=26666
export HOST=localhost
export NODE_ENV=development
export LOG_LEVEL=info
```

## 使用Claude Code

### 环境变量设置

要让Claude Code使用Qwen代理服务，需要设置以下环境变量：

```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:26666
export ANTHROPIC_AUTH_TOKEN=sk-qwen
```

### 命令行测试

你可以使用claudeQwen命令测试连接：

```bash
# 设置环境变量
export ANTHROPIC_BASE_URL=http://127.0.0.1:26666
export ANTHROPIC_AUTH_TOKEN=sk-qwen

# 测试连接（如果有claudeQwen命令）
claudeQwen "查看当前目录信息"
```

## API端点

### 1. 健康检查

```bash
GET /health
```

响应示例：
```json
{
  "service": "qwen-api-proxy",
  "status": "healthy",
  "timestamp": "2025-08-22T10:25:33.645Z",
  "checks": {
    "api_server": {
      "status": "healthy",
      "details": {
        "uptime": 59.442,
        "memory_usage": {...},
        "node_version": "v20.19.3"
      }
    },
    "oauth_credentials": {
      "status": "healthy",
      "details": {
        "has_credentials": true,
        "is_expired": false,
        "expiry_date": "2025-08-22T12:55:56.454Z",
        "resource_url": "portal.qwen.ai"
      }
    },
    "model_configuration": {
      "status": "healthy",
      "details": {
        "target_model": "qwen3-coder-plus",
        "supported_anthropic_models": [
          "claude-3-opus-20240229",
          "claude-3-sonnet-20240229", 
          "claude-3-haiku-20240307"
        ]
      }
    }
  }
}
```

### 2. 模型列表

```bash
GET /v1/models
```

响应示例：
```json
{
  "object": "list",
  "data": [
    {
      "id": "qwen3-coder-plus",
      "object": "model",
      "created": 1704067200,
      "owned_by": "qwen"
    },
    {
      "id": "claude-3-opus-20240229", 
      "object": "model",
      "created": 1704067200,
      "owned_by": "anthropic"
    }
  ]
}
```

### 3. 消息处理

```bash
POST /v1/messages
Content-Type: application/json
Authorization: Bearer sk-qwen
```

请求示例：
```json
{
  "model": "claude-3-opus-20240229",
  "max_tokens": 100,
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ]
}
```

响应示例：
```json
{
  "id": "msg_Z8pmr98K0svkPPenvBh0GBIf",
  "type": "message", 
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! I'm doing well, thank you for asking..."
    }
  ],
  "model": "claude-3-opus-20240229",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 14,
    "output_tokens": 36
  }
}
```

## 模型映射

- **固定模型**: 所有请求都使用`qwen3-coder-plus`模型
- **支持的Anthropic模型名称**:
  - `claude-3-opus-20240229`
  - `claude-3-sonnet-20240229`
  - `claude-3-haiku-20240307`
- **日志记录**: 会记录原始请求的模型信息

## 测试

### 健康检查测试
```bash
curl http://localhost:26666/health
```

### 模型列表测试
```bash
curl http://localhost:26666/v1/models \
  -H "Authorization: Bearer sk-qwen"
```

### 消息测试
```bash
curl -X POST http://localhost:26666/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-qwen" \
  -d '{
    "model": "claude-3-opus-20240229",
    "max_tokens": 50,
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ]
  }'
```

## 日志

服务使用Winston进行双重日志输出：

### 控制台日志
- 彩色格式化输出
- 实时显示请求处理过程

### 文件日志
- `logs/app.log`: 所有日志
- `logs/error.log`: 错误日志
- `logs/access-%DATE%.log`: 按日期轮转的访问日志

## 故障排除

### 1. OAuth凭证问题
如果健康检查显示OAuth状态不健康：
- 检查`~/.qwen/oauth_creds.json`文件是否存在
- 确认access_token是否过期
- 检查refresh_token是否有效

### 2. 端口占用
如果提示端口被占用：
```bash
export PORT=26667  # 使用其他端口
npm run dev
```

### 3. 连接问题
如果Claude Code无法连接：
- 确认服务是否正常启动
- 检查ANTHROPIC_BASE_URL是否正确设置
- 确认防火墙没有阻止连接

## 注意事项

1. **认证**: 服务不验证ANTHROPIC_AUTH_TOKEN，任何值都可以
2. **模型转换**: 所有模型请求都会转换为qwen3-coder-plus
3. **Token管理**: 服务自动处理Qwen OAuth token的刷新
4. **日志隐私**: 生产环境建议调整日志级别以保护敏感信息