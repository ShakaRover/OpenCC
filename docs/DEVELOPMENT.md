# OpenClaude 开发者文档

## 📖 项目概述

OpenClaude 是一个企业级的协议转换器，用于实现 Anthropic Claude API 和 OpenAI API 之间的无缝转换。本文档面向开发者，提供详细的技术实现细节和扩展指南。

## 🏗️ 架构设计

### 核心组件

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   HTTP Client   │───▶│  OpenClaude     │───▶│   OpenAI API    │
│  (Anthropic)    │    │   Converter     │    │    Service      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                       ┌─────────────────┐
                       │   Monitoring    │
                       │   & Logging     │
                       └─────────────────┘
```

### 技术栈

- **运行时**: Node.js 18+
- **语言**: TypeScript 5.3+
- **Web 框架**: Express.js 4.x
- **HTTP 客户端**: Axios
- **测试框架**: Jest
- **代码质量**: ESLint + Prettier
- **构建工具**: TypeScript Compiler

### 目录结构

```
src/
├── types/              # TypeScript 类型定义
│   ├── anthropic.ts    # Anthropic API 类型
│   ├── openai.ts       # OpenAI API 类型
│   ├── common.ts       # 通用类型
│   └── index.ts        # 类型导出
├── converters/         # 协议转换器
│   ├── anthropic-to-openai.ts
│   ├── openai-to-anthropic.ts
│   └── index.ts
├── middleware/         # Express 中间件
│   ├── auth.ts         # 认证中间件
│   ├── cors.ts         # CORS 配置
│   ├── error-handler.ts # 错误处理
│   ├── logging.ts      # 日志记录
│   ├── rate-limit.ts   # 速率限制
│   └── index.ts
├── services/           # 业务服务
│   ├── openai-service.ts
│   ├── conversion-service.ts
│   └── index.ts
├── routes/             # API 路由
│   ├── messages.ts     # 消息处理
│   ├── models.ts       # 模型信息
│   ├── health.ts       # 健康检查
│   └── index.ts
├── config/             # 配置管理
│   ├── config-manager.ts
│   └── index.ts
├── utils/              # 工具函数
│   └── helpers.ts
├── app.ts              # Express 应用
└── index.ts            # 入口文件
```

## 🔄 协议转换详解

### 请求转换流程

1. **请求验证**: 验证 Anthropic 请求格式和必需参数
2. **不支持内容检查**: 检查音频和文件内容并拒绝
3. **模型映射**: 将 Anthropic 模型映射到 OpenAI 模型
4. **消息转换**: 转换消息格式和内容结构
5. **工具转换**: 转换工具定义格式
6. **参数调整**: 调整参数范围和默认值

### 响应转换流程

1. **响应解析**: 解析 OpenAI 响应结构
2. **内容重构**: 将字符串内容包装为 Anthropic 数组格式
3. **字段映射**: 映射字段名称和值
4. **ID 生成**: 生成 Anthropic 风格的消息 ID
5. **错误转换**: 转换错误格式和类型

### 流式处理

```typescript
// 流式转换示例
async function *processStream(openaiStream: AsyncIterable<string>) {
  let isFirst = true;
  
  for await (const chunk of openaiStream) {
    if (isFirst) {
      yield createMessageStart();
      yield createContentBlockStart();
      isFirst = false;
    }
    
    const parsedChunk = parseOpenAIChunk(chunk);
    const anthropicChunks = convertToAnthropicChunks(parsedChunk);
    
    for (const anthropicChunk of anthropicChunks) {
      yield formatStreamChunk(anthropicChunk);
    }
  }
}
```

## 🔧 扩展开发

### 添加新的模型映射

1. 编辑 `config/model-mapping.json`:

```json
{
  "new-anthropic-model": {
    "openaiModel": "gpt-4",
    "contextLength": 8192,
    "maxTokens": 4096,
    "capabilities": ["text", "tools"]
  }
}
```

2. 更新类型定义（如需要）:

```typescript
// src/types/anthropic.ts
export type AnthropicModel = 
  | 'claude-3-opus-20240229'
  | 'new-anthropic-model'  // 添加新模型
  | ...;
```

### 添加新的中间件

```typescript
// src/middleware/custom-middleware.ts
import { Request, Response, NextFunction } from 'express';

export function customMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // 中间件逻辑
    next();
  };
}
```

### 添加新的路由

```typescript
// src/routes/custom.ts
import { Router } from 'express';

export function createCustomRouter(): Router {
  const router = Router();
  
  router.get('/custom', (req, res) => {
    res.json({ message: 'Custom endpoint' });
  });
  
  return router;
}
```

### 自定义转换逻辑

```typescript
// 扩展转换器
export class ExtendedConverter extends AnthropicToOpenAIConverter {
  async convertRequest(request: AnthropicRequest, context: ConversionContext) {
    // 预处理
    const preprocessedRequest = this.preprocess(request);
    
    // 调用父类转换
    const result = await super.convertRequest(preprocessedRequest, context);
    
    // 后处理
    if (result.success && result.data) {
      result.data = this.postprocess(result.data);
    }
    
    return result;
  }
  
  private preprocess(request: AnthropicRequest): AnthropicRequest {
    // 自定义预处理逻辑
    return request;
  }
  
  private postprocess(request: OpenAIRequest): OpenAIRequest {
    // 自定义后处理逻辑
    return request;
  }
}
```

## 🧪 测试策略

### 单元测试

```typescript
// 转换器测试
describe('AnthropicToOpenAIConverter', () => {
  it('should convert basic request', async () => {
    const result = await converter.convertRequest(mockRequest, mockContext);
    expect(result.success).toBe(true);
    expect(result.data?.model).toBe('gpt-4-turbo-preview');
  });
});
```

### 集成测试

```typescript
// API 端点测试
describe('Messages API', () => {
  it('should handle valid request', async () => {
    const response = await request(app)
      .post('/v1/messages')
      .set('x-api-key', 'test-key')
      .send(validRequest)
      .expect(200);
      
    expect(response.body.type).toBe('message');
  });
});
```

### 性能测试

```typescript
// 负载测试示例
describe('Performance Tests', () => {
  it('should handle concurrent requests', async () => {
    const requests = Array(100).fill(null).map(() => 
      request(app).post('/v1/messages')
        .set('x-api-key', 'test-key')
        .send(testRequest)
    );
    
    const responses = await Promise.all(requests);
    expect(responses.every(r => r.status === 200)).toBe(true);
  });
});
```

## 📊 监控和指标

### 内置指标

- **请求计数**: 总请求数、成功请求数、失败请求数
- **响应时间**: 平均响应时间、95分位数、99分位数
- **错误率**: 按错误类型分类的错误率
- **令牌使用**: 输入令牌数、输出令牌数
- **模型使用**: 各模型的使用统计

### 自定义指标

```typescript
// 添加自定义指标
export class CustomMetrics {
  private metrics = new Map<string, number>();
  
  increment(key: string, value: number = 1): void {
    this.metrics.set(key, (this.metrics.get(key) || 0) + value);
  }
  
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }
}
```

### 健康检查扩展

```typescript
// 自定义健康检查
export async function customHealthCheck(): Promise<HealthCheckResult> {
  const checks = await Promise.all([
    checkDatabaseConnection(),
    checkExternalService(),
    checkMemoryUsage()
  ]);
  
  return {
    status: checks.every(c => c.healthy) ? 'healthy' : 'unhealthy',
    details: checks
  };
}
```

## 🐛 调试指南

### 开启调试日志

```bash
DEBUG_MODE=true VERBOSE_LOGGING=true npm run dev
```

### 常见问题排查

1. **认证失败**
   - 检查 API 密钥格式
   - 验证请求头设置

2. **转换错误**
   - 检查输入数据格式
   - 查看转换器日志

3. **性能问题**
   - 检查响应时间指标
   - 分析内存使用情况

4. **OpenAI API 错误**
   - 检查 API 密钥有效性
   - 验证网络连接

### 日志分析

```bash
# 过滤错误日志
cat logs/app.log | grep "ERROR"

# 分析响应时间
cat logs/app.log | grep "duration" | awk '{print $NF}' | sort -n
```

## 🚀 部署指南

### Docker 部署

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY config/ ./config/

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 环境配置

```yaml
# docker-compose.yml
version: '3.8'
services:
  openclaude:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - LOG_LEVEL=info
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 负载均衡

```nginx
# nginx.conf
upstream openclaude {
    server localhost:3000;
    server localhost:3001;
    server localhost:3002;
}

server {
    listen 80;
    location / {
        proxy_pass http://openclaude;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🔐 安全最佳实践

### API 密钥管理

- 使用环境变量存储敏感信息
- 定期轮换 API 密钥
- 实施最小权限原则

### 网络安全

- 使用 HTTPS 传输
- 配置适当的 CORS 策略
- 实施 IP 白名单（如需要）

### 输入验证

```typescript
// 严格的输入验证
function validateRequest(req: AnthropicRequest): ValidationResult {
  const schema = z.object({
    model: z.string().min(1),
    max_tokens: z.number().positive(),
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.union([z.string(), z.array(z.object({}))])
    })).min(1)
  });
  
  try {
    schema.parse(req);
    return { valid: true };
  } catch (error) {
    return { valid: false, errors: error.errors };
  }
}
```

## 📈 性能优化

### 响应时间优化

1. **连接池**: 配置 HTTP 客户端连接池
2. **缓存**: 实施适当的缓存策略
3. **压缩**: 启用 gzip 压缩
4. **异步处理**: 使用异步/非阻塞操作

### 内存管理

```typescript
// 内存监控
function monitorMemory(): void {
  const usage = process.memoryUsage();
  if (usage.heapUsed > MEMORY_THRESHOLD) {
    console.warn('High memory usage detected:', usage);
    // 触发清理或告警
  }
}

setInterval(monitorMemory, 60000); // 每分钟检查
```

### 并发控制

```typescript
// 限制并发请求数
const concurrencyLimiter = new Semaphore(MAX_CONCURRENT_REQUESTS);

async function processRequest(request: AnthropicRequest) {
  await concurrencyLimiter.acquire();
  try {
    return await actualProcessing(request);
  } finally {
    concurrencyLimiter.release();
  }
}
```

## 🤝 贡献指南

### 代码规范

1. **TypeScript**: 使用严格模式，完整的类型注解
2. **ESLint**: 遵循项目的 ESLint 配置
3. **Prettier**: 统一代码格式
4. **测试**: 新功能必须包含测试用例
5. **文档**: 更新相关文档

### 提交规范

```
feat: 添加新功能
fix: 修复bug
docs: 更新文档
style: 代码格式调整
refactor: 代码重构
test: 添加测试
chore: 构建或工具相关更改
```

### Pull Request 流程

1. Fork 仓库并创建特性分支
2. 编写代码和测试
3. 运行所有测试和检查
4. 提交 PR 并描述更改
5. 响应代码审查意见
6. 合并到主分支

---

更多详细信息，请参考项目的 [API 文档](API.md) 和 [部署指南](DEPLOYMENT.md)。