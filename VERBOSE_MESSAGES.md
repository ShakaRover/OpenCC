# 详细消息日志功能 (verbose-messages)

## 概述

`--verbose-messages` 参数为 OpenCC 协议转换器提供了详细的消息内容日志记录功能。启用此功能后，系统将记录完整的消息处理流程，包括：

1. **请求原消息** - 客户端发送的原始 Anthropic 格式请求
2. **重构原消息** - 转换为 OpenAI 格式的请求
3. **返回原消息** - 从 OpenAI API 获得的原始响应
4. **返回重构消息** - 转换回 Anthropic 格式的最终响应

## 使用方法

### 命令行参数

#### 基本用法
```bash
# 启用详细消息日志
npm start -- --verbose-messages

# 或者使用完整启动命令
node dist/src/index.js --verbose-messages
```

#### 与其他参数组合使用
```bash
# 与 OpenAI API 配置组合
npm start -- --openai-api-key sk-your-key --openai-base-url https://api.openai.com --verbose-messages

# 与 Qwen OAuth 配置组合  
npm start -- --qwen-oauth-file ~/.qwen/oauth_creds.json --verbose-messages

# 与模型映射组合
npm start -- --model gpt-4 --verbose-messages

# 等号形式参数
npm start -- --verbose-messages=true
npm start -- --verbose-messages=false
```

### 环境变量

也可以通过环境变量启用：

```bash
# 设置环境变量
export VERBOSE_MESSAGES=true
npm start

# 或者在启动时设置
VERBOSE_MESSAGES=true npm start
```

**注意**：CLI 参数的优先级高于环境变量。

## 日志输出示例

### 1. 请求原消息（Anthropic格式）

启用 `--verbose-messages` 后，系统会记录客户端发送的原始请求：

```json
{
  "timestamp": "2024-01-20T10:30:45.123Z",
  "level": "info",
  "message": "Request started",
  "requestId": "req_1705747845123_abc123def",
  "method": "POST",
  "url": "/v1/messages",
  "originalModel": "claude-3-opus-20240229",
  "requestBody": {
    "model": "claude-3-opus-20240229",
    "messages": [
      {
        "role": "user",
        "content": "你好，请介绍一下自己"
      }
    ],
    "maxTokens": 1000,
    "temperature": 0.7,
    "stream": false
  }
}
```

### 2. 重构原消息（转换为OpenAI格式）

系统会记录转换后的 OpenAI 格式请求：

```json
{
  "timestamp": "2024-01-20T10:30:45.135Z",
  "level": "info", 
  "message": "Converted request (Anthropic -> OpenAI)",
  "requestId": "req_1705747845123_abc123def",
  "convertedRequest": {
    "model": "gpt-4",
    "messages": [
      {
        "role": "user",
        "content": "你好，请介绍一下自己"
      }
    ],
    "maxTokens": 1000,
    "temperature": 0.7,
    "stream": false
  }
}
```

### 3. 返回原消息（OpenAI API响应）

记录从 OpenAI API 收到的原始响应：

```json
{
  "timestamp": "2024-01-20T10:30:47.456Z",
  "level": "info",
  "message": "Original response (from OpenAI API)",
  "requestId": "req_1705747845123_abc123def",
  "originalResponse": {
    "id": "chatcmpl-8mGvX7b2M1j9K3nL4p6Q8rS5tU9wV",
    "model": "gpt-4",
    "object": "chat.completion",
    "created": 1705747847,
    "choices": [
      {
        "index": 0,
        "message": {
          "role": "assistant",
          "content": "你好！我是ChatGPT，由OpenAI开发的人工智能助手..."
        },
        "finishReason": "stop"
      }
    ],
    "usage": {
      "prompt_tokens": 12,
      "completion_tokens": 45,
      "total_tokens": 57
    }
  }
}
```

### 4. 返回重构消息（转换为Anthropic格式）

记录最终返回给客户端的 Anthropic 格式响应：

```json
{
  "timestamp": "2024-01-20T10:30:47.468Z",
  "level": "info",
  "message": "Converted response (OpenAI -> Anthropic)",
  "requestId": "req_1705747845123_abc123def",
  "convertedResponse": {
    "id": "msg_8mGvX7b2M1j9K3nL4p6Q8rS5tU9wV",
    "type": "message",
    "role": "assistant", 
    "model": "claude-3-opus-20240229",
    "content": [
      {
        "type": "text",
        "text": "你好！我是ChatGPT，由OpenAI开发的人工智能助手..."
      }
    ],
    "stopReason": "end_turn",
    "stopSequence": null,
    "usage": {
      "input_tokens": 12,
      "output_tokens": 45
    }
  }
}
```

## 流式响应的详细日志

对于流式响应，系统会记录每个流式块的转换过程：

### 原始流式块（来自API提供商）
```json
{
  "timestamp": "2024-01-20T10:30:47.200Z",
  "level": "info",
  "message": "Original stream chunk (from API provider)",
  "requestId": "req_1705747845123_abc123def",
  "chunkData": {
    "id": "chatcmpl-8mGvX7b2M1j9K3nL4p6Q8rS5tU9wV",
    "object": "chat.completion.chunk",
    "created": 1705747847,
    "model": "gpt-4",
    "choices": [
      {
        "index": 0,
        "delta": {
          "content": "你好！"
        },
        "finishReason": null
      }
    ]
  }
}
```

### 转换后的流式块（Anthropic格式）
```json
{
  "timestamp": "2024-01-20T10:30:47.205Z",
  "level": "info",
  "message": "Converted stream chunks (to Anthropic format)",
  "requestId": "req_1705747845123_abc123def",
  "chunkCount": 1,
  "chunks": [
    {
      "type": "content_block_delta",
      "index": 0,
      "delta": {
        "type": "text_delta",
        "text": "你好！"
      }
    }
  ]
}
```

## 配置集成

### 与现有日志配置的关系

`verbose-messages` 参数与现有的日志配置协同工作：

```javascript
// 完整的日志配置示例
{
  "logging": {
    "level": "info",           // 日志级别
    "format": "json",          // 日志格式  
    "verboseLogging": false,   // 现有的详细日志选项
    "verboseMessages": true    // 新增的消息内容详细日志
  }
}
```

### 环境变量支持

支持以下环境变量：

- `VERBOSE_MESSAGES=true|false` - 启用/禁用详细消息日志
- `LOG_LEVEL=debug|info|warn|error` - 设置日志级别
- `LOG_FORMAT=json|simple` - 设置日志格式

## 性能考虑

### 日志开销

启用 `--verbose-messages` 会增加一定的性能开销：

1. **内存使用**：需要存储完整的请求和响应内容
2. **IO开销**：增加日志写入操作
3. **序列化开销**：JSON序列化大型消息对象

### 最佳实践

1. **开发环境**：推荐启用，便于调试和问题排查
2. **生产环境**：谨慎使用，建议只在需要调试时临时启用
3. **日志轮转**：配合日志轮转机制，避免日志文件过大

```bash
# 生产环境示例：只在需要时启用
npm start -- --verbose-messages --log-level warn
```

## 故障排查

### 常见问题

#### 1. 日志中没有详细消息内容
检查配置是否正确启用：
```bash
# 验证配置
curl -s http://localhost:26666/health | jq '.config.logging.verboseMessages'
```

#### 2. 日志文件过大
配置日志轮转：
```bash
# 设置日志文件大小限制
export MAX_LOG_SIZE=50mb
export MAX_LOG_FILES=7
```

#### 3. 性能问题
监控资源使用：
```bash
# 监控内存使用
ps aux | grep node
# 监控磁盘使用
du -sh logs/
```

### 调试技巧

1. **筛选特定请求**：使用 `requestId` 过滤日志
2. **时间范围分析**：结合时间戳分析请求处理时间
3. **错误关联**：通过请求ID关联错误日志

```bash
# 筛选特定请求的所有日志
grep "req_1705747845123_abc123def" logs/app.log

# 分析请求处理时间
grep "Request started\|Request completed" logs/app.log | grep "req_1705747845123_abc123def"
```

## 安全注意事项

⚠️ **重要提醒**：启用详细消息日志会在日志中记录完整的请求和响应内容，可能包含敏感信息：

- API密钥片段
- 用户输入内容  
- 模型输出内容
- 个人身份信息

### 安全建议

1. **访问控制**：确保日志文件访问权限正确设置
2. **数据脱敏**：在生产环境考虑实施敏感数据脱敏
3. **日志清理**：定期清理包含敏感信息的日志文件
4. **合规要求**：遵守相关的数据保护法规

```bash
# 设置日志文件权限
chmod 600 logs/*.log
chown app:app logs/*.log
```

## 总结

`--verbose-messages` 参数提供了强大的调试和监控能力，通过记录完整的消息处理流程，帮助开发者：

- 理解协议转换的详细过程
- 快速定位问题和错误
- 监控系统性能和行为
- 验证转换逻辑的正确性

在使用时请权衡调试需求和性能/安全考虑，选择合适的启用场景。