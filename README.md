# OpenCC 协议转换器

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue)](https://www.typescriptlang.org/)

OpenCC 是一个高性能的协议转换器，实现 Anthropic Claude API 和 OpenAI API 之间的双向转换。允许用户以 Anthropic 格式发送请求，自动转换为 OpenAI 格式与 OpenAI 服务器通信，然后将响应转换回 Anthropic 格式。

## ✨ 核心特性

- 🔄 **协议统一**: 完整的 Anthropic Claude API 到 OpenAI API 协议转换
- 🚀 **高性能**: 基于 Express.js 和 TypeScript 构建，支持流式响应
- 🛡️ **安全可靠**: 内置认证、速率限制、错误处理和日志记录
- 🎯 **功能保真**: 智能转换策略，最大化保持原始 API 的功能特性
- 📊 **监控完善**: 内置健康检查、指标收集和调试信息
- 🔧 **配置灵活**: 支持环境变量配置和模型映射自定义

## 🚫 重要限制

> **注意**: 根据设计要求，以下功能被明确禁用：
> - ❌ **音频输入**: 不支持 `input_audio` 类型内容
> - ❌ **文件上传**: 不支持 `file` 类型内容
> - ❌ **Redis 缓存**: 项目不使用 Redis，采用内存缓存

此协议转换器主要用于测试和比较模型能力，不建议作为生产环境的长期解决方案。

## 📋 系统要求

- **Node.js**: ≥ 18.0.0
- **npm**: ≥ 9.0.0 或 **yarn**: ≥ 1.22.0
- **OpenAI API Key**: 有效的 OpenAI API 密钥

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-org/opencc.git
cd opencc
```

### 2. 安装依赖

```bash
npm install
# 或
yarn install
```

### 3. 配置环境

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置必要的环境变量：

```bash
# 必需配置
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000

# 可选配置
NODE_ENV=development
LOG_LEVEL=info
```

### 4. 启动服务

#### qwen-cli 模式（默认）

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm run build
npm start
```

#### 通用 OpenAI 模式

```bash
# 使用自定义 OpenAI API
npm start -- --openai-api-key sk-your-key-here --openai-base-url https://api.your-provider.com

# 或通过环境变量
export OPENAI_API_KEY=sk-your-key-here
export OPENAI_BASE_URL=https://api.your-provider.com
npm start
```

#### 支持的命令行参数

- `--openai-api-key <key>`: OpenAI API 密钥
- `--openai-base-url <url>`: OpenAI API 端点 URL
- `--qwen-oauth-file <path>`: qwen OAuth 认证文件路径
- `--model <model>`: 默认使用的模型
- `--model-mapping <file|json>`: 模型映射文件或 JSON 数据

### 5. 验证服务

```bash
curl http://localhost:3000/health
```

## 📖 API 使用指南

### 基础请求格式

OpenCC 完全兼容 Anthropic Claude API 格式：

```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "model": "claude-3-opus-20240229",
    "max_tokens": 100,
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ]
  }'
```

### 支持的端点

| 端点 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/` | GET | API 信息 | ❌ |
| `/v1/messages` | POST | 消息对话 | ✅ |
| `/v1/models` | GET | 模型列表 | ✅ |
| `/v1/models/{id}` | GET | 模型详情 | ✅ |
| `/health` | GET | 健康检查 | ❌ |
| `/health/detailed` | GET | 详细健康信息 | ❌ |
| `/health/metrics` | GET | 指标信息 | ❌ |

### 模型映射

| Anthropic 模型 | 映射的 OpenAI 模型 | 上下文长度 | 能力特点 |
|----------------|-------------------|------------|----------|
| `claude-3-opus-20240229` | `gpt-4-turbo-preview` | 128K | 最强推理能力 |
| `claude-opus-4-20250514` | `gpt-4-turbo-preview` | 128K | 最新版本 |
| `claude-3-sonnet-20240229` | `gpt-4` | 8K | 平衡性能 |
| `claude-3-haiku-20240307` | `gpt-3.5-turbo` | 16K | 快速响应 |
| `claude-instant-1.2` | `gpt-3.5-turbo` | 16K | 轻量级处理 |

### 流式响应

```bash
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

### 工具使用

```json
{
  "model": "claude-3-opus-20240229",
  "max_tokens": 200,
  "messages": [
    {
      "role": "user",
      "content": "What's the weather like in San Francisco?"
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
          }
        },
        "required": ["location"]
      }
    }
  ]
}
```

## ⚙️ 配置选项

### 环境变量

| 变量名 | 默认值 | 描述 |
|--------|--------|---------|
| `PORT` | `3000` | 服务端口 |
| `HOST` | `localhost` | 服务主机 |
| `NODE_ENV` | `development` | 运行环境 |
| `OPENAI_API_KEY` | 必需 | OpenAI API 密钥 |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI API 基础URL |
| `OPENAI_TIMEOUT` | `30000` | 请求超时时间（毫秒） |
| `RATE_LIMIT_WINDOW_MS` | `900000` | 速率限制窗口期（15分钟） |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | 最大请求数 |
| `LOG_LEVEL` | `info` | 日志级别 |
| `LOG_FORMAT` | `json` | 日志格式 |
| `CORS_ORIGIN` | `*` | CORS 允许的源 |
| `REQUEST_TIMEOUT` | `60000` | 请求超时时间 |
| `MAX_REQUEST_SIZE` | `10mb` | 最大请求体大小 |

### 模型映射配置

可以通过修改 `config/model-mapping.json` 文件自定义模型映射：

```json
{
  "claude-custom-model": {
    "openaiModel": "gpt-4",
    "contextLength": 8192,
    "maxTokens": 4096,
    "capabilities": ["text", "tools"]
  }
}
```

## 🧪 开发和测试

### 开发模式

```bash
# 启动开发服务器（热重载）
npm run dev

# 类型检查
npm run typecheck

# 代码格式化
npm run format

# 代码检查
npm run lint
npm run lint:fix
```

### 运行测试

```bash
# 运行所有测试
npm test

# 监视模式
npm run test:watch

# 覆盖率报告
npm run test:coverage
```

### 构建项目

```bash
# 构建生产版本
npm run build

# 启动生产服务
npm start
```

## 📊 监控和调试

### 健康检查

```bash
# 基础健康检查
curl http://localhost:3000/health

# 详细健康信息
curl http://localhost:3000/health/detailed

# 指标信息
curl http://localhost:3000/health/metrics
```

### 日志配置

```bash
# 设置详细日志
VERBOSE_LOGGING=true npm run dev

# 设置调试模式
DEBUG_MODE=true npm run dev
```

## 🔒 安全注意事项

1. **API 密钥管理**: 确保 OpenAI API 密钥安全存储，不要提交到版本控制
2. **速率限制**: 根据使用情况调整速率限制配置
3. **CORS 配置**: 生产环境中限制 CORS 源
4. **认证**: 确保客户端使用有效的 API 密钥
5. **网络安全**: 使用 HTTPS 部署，考虑反向代理

## 🐛 错误处理

### 常见错误代码

| 状态码 | 错误类型 | 描述 |
|--------|----------|------|
| 400 | `invalid_request_error` | 请求参数无效 |
| 401 | `authentication_error` | 认证失败 |
| 429 | `rate_limit_error` | 速率限制 |
| 500 | `api_error` | 服务器内部错误 |

### 错误响应格式

```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "Missing required parameter: max_tokens"
  }
}
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'Add amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 提交 Pull Request

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 和 Prettier 配置
- 编写测试用例
- 更新文档

## 📚 文档链接

- [通用 OpenAI 配置功能指南](docs/UNIVERSAL_OPENAI.md) - 详细的配置和使用说明
- [API 参考文档](docs/API.md) - 完整的 API 接口文档
- [开发指南](docs/DEVELOPMENT.md) - 开发环境搭建和扩展指南

---

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Anthropic](https://www.anthropic.com/) - Claude API 规范
- [OpenAI](https://openai.com/) - GPT API 兼容性
- [Express.js](https://expressjs.com/) - Web 框架
- [TypeScript](https://www.typescriptlang.org/) - 类型安全

## 📞 支持

- 📚 [文档](https://github.com/your-org/opencc/wiki)
- 🐛 [问题追踪](https://github.com/your-org/opencc/issues)
- 💬 [讨论区](https://github.com/your-org/opencc/discussions)

---

**⚠️ 免责声明**: 此项目仅用于技术研究和测试目的。在生产环境中使用前，请仔细评估其适用性和安全性。