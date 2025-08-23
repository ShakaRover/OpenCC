# OpenCC All Method 根路径路由设计

## 1. 概述

本设计文档描述了为 OpenCC 协议转换器项目添加一个新的路由功能，该路由将响应所有 HTTP 方法（GET、POST、PUT、DELETE、PATCH 等）对根路径 `/` 的请求，统一返回状态码 200 和内容 "OpenCC"。

### 需求背景
- 当前根路径 `/` 重定向到健康检查端点 `/health`
- 需要为根路径添加一个通用的响应，支持所有 HTTP 方法
- 响应内容应为简单的文本 "OpenCC"，表明服务身份

### 设计目标
- 实现对根路径 `/` 所有 HTTP 方法的统一处理
- 保持简单的响应格式和快速响应时间
- 不影响现有的健康检查和其他API功能
- 确保与现有中间件兼容

## 2. 技术架构

### 2.1 当前路由结构

```mermaid
graph TD
    A[Express App] --> B[CORS 中间件]
    B --> C[JSON 解析中间件]
    C --> D[请求日志中间件]
    D --> E{路由匹配}
    
    E --> F[/v1/messages - 消息处理]
    E --> G[/v1/models - 模型列表]
    E --> H[/health - 健康检查]
    E --> I[/ - 重定向到 /health]
    E --> J[404 处理]
```

### 2.2 新的路由结构

```mermaid
graph TD
    A[Express App] --> B[CORS 中间件]
    B --> C[JSON 解析中间件]
    C --> D[请求日志中间件]
    D --> E{路由匹配}
    
    E --> F[/v1/messages - 消息处理]
    E --> G[/v1/models - 模型列表]
    E --> H[/health - 健康检查]
    E --> I[/ - All Methods -> OpenCC]
    E --> J[404 处理]
    
    style I fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
```

## 3. 实现方案

### 3.1 路由配置更新

需要修改 `src/app.ts` 文件中的根路径处理逻辑：

**当前实现:**
```typescript
// 根路径重定向到健康检查
app.get('/', (req, res) => {
  res.redirect('/health');
});
```

**新的实现:**
```typescript
// 根路径处理所有HTTP方法
app.all('/', (req, res) => {
  logger.debug('Root path request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  
  res.status(200).send('OpenCC');
});
```

### 3.2 中间件集成

新的路由将自动继承现有的中间件栈：

1. **CORS 中间件**: 处理跨域请求
2. **请求日志中间件**: 记录访问日志
3. **JSON 解析中间件**: 解析请求体（对于需要的HTTP方法）
4. **OPTIONS 预检处理**: 自动处理CORS预检请求

### 3.3 HTTP 方法支持

路由将支持所有标准HTTP方法：

| HTTP 方法 | 支持状态 | 响应 |
|-----------|----------|------|
| GET | ✅ | 200 "OpenCC" |
| POST | ✅ | 200 "OpenCC" |
| PUT | ✅ | 200 "OpenCC" |
| DELETE | ✅ | 200 "OpenCC" |
| PATCH | ✅ | 200 "OpenCC" |
| HEAD | ✅ | 200 (无响应体) |
| OPTIONS | ✅ | 200 (CORS处理) |

## 4. 响应规范

### 4.1 响应格式

```http
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 6

OpenCC
```

### 4.2 响应特性

- **状态码**: 固定返回 200 OK
- **内容类型**: `text/plain; charset=utf-8`
- **响应体**: 纯文本 "OpenCC"
- **响应时间**: < 10ms（无业务逻辑处理）

### 4.3 日志记录

每个请求都会被记录到访问日志中：

```json
{
  "level": "debug",
  "message": "Root path request",
  "method": "GET",
  "url": "/",
  "userAgent": "curl/7.68.0",
  "ip": "127.0.0.1",
  "timestamp": "2024-01-20T10:30:45.123Z"
}
```

## 5. 实现步骤

### 5.1 代码修改

1. **修改 src/app.ts**
   - 替换当前的根路径重定向逻辑
   - 添加 `app.all('/', ...)` 路由处理器
   - 添加适当的日志记录

2. **保持现有功能**
   - 不影响 `/health` 健康检查端点
   - 不影响 `/v1/messages` 和 `/v1/models` API
   - 保持中间件链完整性

### 5.2 测试验证

**手动测试用例:**

```bash
# GET 请求测试
curl -X GET http://localhost:3000/
# 期望: HTTP 200, 响应体 "OpenCC"

# POST 请求测试
curl -X POST http://localhost:3000/
# 期望: HTTP 200, 响应体 "OpenCC"

# PUT 请求测试
curl -X PUT http://localhost:3000/
# 期望: HTTP 200, 响应体 "OpenCC"

# DELETE 请求测试
curl -X DELETE http://localhost:3000/
# 期望: HTTP 200, 响应体 "OpenCC"

# HEAD 请求测试
curl -I http://localhost:3000/
# 期望: HTTP 200, 无响应体

# OPTIONS 请求测试
curl -X OPTIONS http://localhost:3000/
# 期望: HTTP 200, CORS头信息
```

## 6. 架构影响分析

### 6.1 性能影响

- **正面影响**: 根路径响应更快，无重定向开销
- **负面影响**: 无显著负面影响
- **资源消耗**: 极低，仅返回静态文本

### 6.2 安全考虑

- **认证**: 根路径无需认证，保持公开访问
- **速率限制**: 继承全局中间件的速率限制策略
- **日志审计**: 所有访问均被记录，便于监控

### 6.3 兼容性

- **向后兼容**: 替换重定向行为，可能影响依赖重定向的客户端
- **API兼容**: 不影响现有API端点
- **中间件兼容**: 完全兼容现有中间件栈

## 7. 监控和运维

### 7.1 监控指标

可通过现有日志系统监控以下指标：

- 根路径访问频率
- 不同HTTP方法的使用分布
- 响应时间分布
- 错误率（应为0%）

### 7.2 故障排除

**常见问题及解决方案:**

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 返回404 | 路由配置错误 | 检查 `app.all('/')` 配置 |
| CORS错误 | 中间件顺序问题 | 确保CORS中间件在路由之前 |
| 响应格式错误 | Content-Type设置问题 | 检查响应头设置 |

### 7.3 日志分析

通过以下查询可分析根路径访问模式：

```bash
# 统计根路径访问量
grep "Root path request" logs/*.log | wc -l

# 分析HTTP方法分布
grep "Root path request" logs/*.log | jq '.method' | sort | uniq -c

# 分析访问来源
grep "Root path request" logs/*.log | jq '.ip' | sort | uniq -c
```

## 8. 测试策略

### 8.1 单元测试

为新的路由功能编写单元测试：

```typescript
describe('Root Path Route', () => {
  test('should return 200 and "OpenCC" for GET request', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toBe('OpenCC');
  });

  test('should return 200 and "OpenCC" for POST request', async () => {
    const response = await request(app).post('/');
    expect(response.status).toBe(200);
    expect(response.text).toBe('OpenCC');
  });

  // 其他HTTP方法的测试...
});
```

### 8.2 集成测试

验证新路由与现有系统的集成：

- 确保健康检查端点仍然正常工作
- 验证API端点不受影响
- 测试中间件链的完整性

### 8.3 负载测试

使用工具如 `ab` 或 `wrk` 测试根路径的性能：

```bash
# Apache Bench 测试
ab -n 1000 -c 10 http://localhost:3000/

# wrk 测试
wrk -t12 -c400 -d30s http://localhost:3000/
```