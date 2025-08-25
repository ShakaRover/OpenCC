import { defineConfig } from 'tsup';

export default defineConfig({
  // 入口文件
  entry: ['src/index.ts'],
  
  // 输出目录
  outDir: 'dist',
  
  // 目标环境
  target: 'node18',
  
  // 生成格式
  format: ['esm'], // Node.js ESM 模块
  
  // 代码分割
  splitting: false,
  
  // 清理输出目录
  clean: true,
  
  // 生成 source map
  sourcemap: true,
  
  // 生成声明文件
  dts: true,
  
  // 最小化
  minify: false,
  
  // 外部依赖（不会被打包进输出文件）
  external: [
    'express',
    'cors',
    'helmet',
    'dotenv',
    'axios',
    'winston',
    'winston-daily-rotate-file',
    'uuid',
    'zod',
    'express-rate-limit'
  ],
  
  // Node.js 兼容性
  platform: 'node',
  
  // 不要捆绑 node_modules
  noExternal: [],
  
  // TSUP 配置
  tsconfig: './tsconfig.json'
});