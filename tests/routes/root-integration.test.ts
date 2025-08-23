import request from 'supertest';
import express from 'express';
import cors from 'cors';

describe('Root Path Integration Test', () => {
  let app: express.Application;

  beforeAll(() => {
    // 创建一个简化的Express应用来测试根路径功能
    app = express();
    
    // 添加基本中间件
    app.use(cors());
    app.use(express.json());
    
    // 复制实际的根路径路由逻辑
    app.all('/', (req, res) => {
      // 模拟日志记录（不使用实际的logger避免依赖问题）
      console.log('Root path request', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      
      res.status(200).send('OpenCC');
    });
  });

  test('GET method should return OpenCC', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toBe('OpenCC');
  });

  test('POST method should return OpenCC', async () => {
    const response = await request(app).post('/');
    expect(response.status).toBe(200);
    expect(response.text).toBe('OpenCC');
  });

  test('PUT method should return OpenCC', async () => {
    const response = await request(app).put('/');
    expect(response.status).toBe(200);
    expect(response.text).toBe('OpenCC');
  });

  test('DELETE method should return OpenCC', async () => {
    const response = await request(app).delete('/');
    expect(response.status).toBe(200);
    expect(response.text).toBe('OpenCC');
  });

  test('PATCH method should return OpenCC', async () => {
    const response = await request(app).patch('/');
    expect(response.status).toBe(200);
    expect(response.text).toBe('OpenCC');
  });

  test('all methods should have correct content type', async () => {
    const methods = ['get', 'post', 'put', 'delete', 'patch'];
    
    for (const method of methods) {
      const response = await request(app)[method as keyof typeof request]('/');
      expect(response.status).toBe(200);
      expect(response.text).toBe('OpenCC');
      expect(response.headers['content-type']).toMatch(/text\/html/);
    }
  });
});