# 通用 OpenAI 配置功能使用指南

OpenCC 现在支持更灵活的配置方式，可以使用自定义的 OpenAI API 端点，同时保持与原有 qwen-cli 模式的完全兼容。

## 配置模式

### 1. qwen-cli 模式（默认）

当没有提供任何 OpenAI 配置参数时，系统会自动使用 qwen-cli 模式：

```bash
# 默认模式，使用 qwen-cli OAuth 认证
npm start
```

**特点：**
- 使用 qwen-cli 的 OAuth 认证
- 默认目标模型：`qwen3-coder-plus`
- 兼容现有的使用方式

### 2. 通用 OpenAI 模式

当提供 OpenAI API 密钥或基础 URL 时，系统会切换到通用 OpenAI 模式：

```bash
# 使用自定义 OpenAI API
npm start -- --openai-api-key sk-your-key-here --openai-base-url https://api.your-provider.com

# 或通过环境变量
export OPENAI_API_KEY=sk-your-key-here
export OPENAI_BASE_URL=https://api.your-provider.com
npm start
```

## 命令行参数

### OpenAI 配置参数

- `--openai-api-key <key>`: 指定 OpenAI API 密钥
- `--openai-base-url <url>`: 指定 OpenAI API 端点 URL
- `--model <model>`: 指定默认使用的模型
- `--model-mapping <file|json>`: 指定模型映射文件或 JSON 数据

### qwen-cli 配置参数

- `--qwen-oauth-file <path>`: 指定 qwen OAuth 认证文件路径

## Base URL 处理

系统会自动标准化 Base URL：

```bash
# 这些 URL 都会被标准化为 https://api.custom.com/v1
--openai-base-url https://api.custom.com
--openai-base-url https://api.custom.com/
--openai-base-url https://api.custom.com/v1
--openai-base-url api.custom.com
```

## 模型映射配置

### 新的简化格式

推荐使用新的数组格式，支持多种匹配模式：

```json
{
  "mappings": [
    {
      "pattern": "claude-3-opus",
      "target": "gpt-4-turbo-preview",
      "type": "contains"
    },
    {
      "pattern": "claude-3-sonnet",
      "target": "gpt-4",
      "type": "contains"
    },
    {
      "pattern": "claude-3-haiku",
      "target": "gpt-3.5-turbo",
      "type": "exact"
    },
    {
      "pattern": "qwen-",
      "target": "qwen3-coder-plus",
      "type": "prefix"
    },
    {
      "pattern": "-turbo",
      "target": "gpt-4-turbo-preview",
      "type": "suffix"
    }
  ],
  "defaultModel": "gpt-4"
}
```

### 匹配模式说明

| 模式 | 说明 | 示例 |
|------|------|------|
| `contains` | 包含匹配（默认） | `"claude-3-5"` 匹配 `claude-3-5-sonnet`, `claude-3-5-haiku` |
| `exact` | 精确匹配 | `"gpt-4"` 只匹配 `gpt-4` |
| `prefix` | 前缀匹配 | `"qwen-"` 匹配 `qwen-7b`, `qwen-14b` |
| `suffix` | 后缀匹配 | `"-turbo"` 匹配 `gpt-4-turbo`, `gpt-3.5-turbo` |

### 向后兼容

系统完全支持现有的对象格式：

```json
{
  "claude-3-opus-20240229": {
    "openaiModel": "gpt-4-turbo-preview"
  }
}
```

**注意：** `contextLength`、`maxTokens`、`capabilities` 字段会被自动忽略，因为它们在实际业务逻辑中未被使用。

## 模型优先级

模型选择遵循以下优先级：

1. **映射规则匹配**：按照 `mappings` 数组顺序依次匹配
2. **映射文件的 defaultModel**：优先级高于 `--model` 参数
3. **--model 参数**：等价于 `defaultModel`，但优先级较低
4. **原始模型**：
   - qwen-cli 模式：使用 `qwen3-coder-plus`
   - 通用 OpenAI 模式：保持原始模型名

## 使用示例

### 示例 1：使用 GLM-4 API

```bash
npm start -- \
  --openai-api-key your-glm-key \
  --openai-base-url https://open.bigmodel.cn/api/paas/v4 \
  --model GLM-4 \
  --model-mapping '{
    "mappings": [
      {"pattern": "claude-3-opus", "target": "GLM-4", "type": "contains"},
      {"pattern": "claude-3-sonnet", "target": "GLM-4", "type": "contains"}
    ],
    "defaultModel": "GLM-4"
  }'
```

### 示例 2：使用自定义映射文件

```bash
# 创建映射文件
cat > custom-mapping.json << EOF
{
  "mappings": [
    {
      "pattern": "claude-3-5",
      "target": "gpt-4-turbo-preview",
      "type": "contains"
    }
  ],
  "defaultModel": "gpt-4"
}
EOF

# 启动服务
npm start -- \
  --openai-api-key sk-your-key \
  --openai-base-url https://api.openai.com \
  --model-mapping custom-mapping.json
```

### 示例 3：多API提供商配置

对于不同的API提供商，可以配置不同的映射规则：

```json
{
  "mappings": [
    {
      "pattern": "claude-3-opus",
      "target": "gpt-4-turbo-preview",
      "type": "contains"
    },
    {
      "pattern": "claude-3-sonnet", 
      "target": "gpt-4",
      "type": "contains"
    },
    {
      "pattern": "claude-3-haiku",
      "target": "gpt-3.5-turbo",
      "type": "contains"
    },
    {
      "pattern": "qwen",
      "target": "qwen-turbo",
      "type": "contains"
    }
  ],
  "defaultModel": "gpt-4"
}
```

## 健康检查

新功能增强了健康检查端点，显示当前配置模式：

```bash
curl http://localhost:26666/health
```

响应示例：

```json
{
  "service": "opencc-api-proxy",
  "status": "healthy",
  "checks": {
    "model_configuration": {
      "status": "healthy",
      "details": {
        "config_mode": "universal-openai",
        "default_model": "gpt-4",
        "mapping_rules_count": 5,
        "has_default_mapping": true,
        "openai_base_url": "https://api.custom.com/v1"
      }
    }
  }
}
```

## 环境变量配置

除了命令行参数，也可以通过环境变量配置：

```bash
# OpenAI 配置
export OPENAI_API_KEY=sk-your-key-here
export OPENAI_BASE_URL=https://api.your-provider.com

# 模型映射文件路径
export DEFAULT_MODEL_MAPPING_FILE=/path/to/mapping.json

# 启动服务
npm start
```

## 调试和日志

启动时会显示当前的配置模式：

```
[INFO] Starting OpenCC API proxy server...
[INFO] Configuration mode: universal-openai
[INFO] Base URL: https://api.custom.com/v1
[INFO] Default model: gpt-4
[INFO] Mapping rules: 5
```

## 故障排除

### 常见问题

1. **配置模式检测错误**
   - 检查环境变量和命令行参数是否正确设置
   - 使用 `--openai-api-key` 或 `--openai-base-url` 明确指定模式

2. **Base URL 格式问题**
   - 系统会自动标准化 URL，无需手动添加 `/v1`
   - 确保 URL 可访问且格式正确

3. **模型映射不生效**
   - 检查映射文件格式是否正确
   - 确认匹配模式（contains/exact/prefix/suffix）是否合适
   - 查看健康检查端点了解当前映射状态

4. **认证失败**
   - qwen-cli 模式：确保有有效的 OAuth 文件
   - 通用 OpenAI 模式：检查 API 密钥是否有效

### 日志分析

启用详细日志：

```bash
export LOG_LEVEL=debug
export VERBOSE_LOGGING=true
npm start
```

这将显示详细的配置加载和模型映射过程。