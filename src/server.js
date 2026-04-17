/**
 * Carval Auto Backend - 主服务器入口
 * 
 * 功能：
 * - 提供安全的 RESTful API
 * - 保护 OSS 访问密钥
 * - 管理产品数据
 * 
 * @author Carval Auto
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from 'dotenv';
import { rateLimit } from 'express-rate-limit';

// 加载环境变量
config();

// 导入路由
import healthRoutes from './routes/health.js';
import productRoutes from './routes/products.js';
import syncRoutes from './routes/sync.js';

// 导入中间件
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';
import { corsOptions } from './middleware/cors.js';

// 导入日志服务
import { logger } from './services/logger.js';

// 创建 Express 应用
const app = express();

// 获取配置
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ==================== 中间件配置 ====================

// 安全头
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS 配置
app.use(cors(corsOptions));

// 明确处理 OPTIONS 预检请求
app.options('*', cors(corsOptions));

// 请求日志
app.use(requestLogger);

// Morgan 日志 (仅生产环境)
if (NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// 请求体解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 速率限制
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 分钟
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 最多 100 个请求
  message: {
    error: '请求过于频繁，请稍后再试',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`速率限制触发 - IP: ${req.ip}, 路径: ${req.path}`);
    res.status(429).json(options.message);
  }
});

app.use('/api/', limiter);

// 更加严格的速率限制用于写操作
const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 10, // 最多 10 个写请求
  message: {
    error: '写操作过于频繁，请稍后再试',
    code: 'WRITE_RATE_LIMIT_EXCEEDED',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/products', writeLimiter);

// ==================== 路由配置 ====================

// 健康检查
app.use('/api/health', healthRoutes);

// 产品管理 API
app.use('/api/products', productRoutes);

// 同步 API
app.use('/api/sync', syncRoutes);

// 根路径
app.get('/', (req, res) => {
  res.json({
    name: 'Carval Auto API',
    version: '1.0.0',
    status: 'running',
    documentation: '/api/docs'
  });
});

// ==================== 错误处理 ====================

// 404 处理
app.use(notFoundHandler);

// 全局错误处理
app.use(errorHandler);

// ==================== 启动服务器 ====================

const server = app.listen(PORT, () => {
  logger.info(`🚀 Carval Auto API 服务器启动成功`);
  logger.info(`📍 环境: ${NODE_ENV}`);
  logger.info(`🔌 端口: ${PORT}`);
  logger.info(`🌐 URL: http://localhost:${PORT}`);
});

// 优雅关闭
const gracefulShutdown = async (signal) => {
  logger.info(`\n${signal} 收到关闭信号`);
  
  server.close(async () => {
    logger.info('HTTP 服务器已关闭');
    
    // 在这里添加清理逻辑
    // await cleanupDatabase();
    
    process.exit(0);
  });
  
  // 30 秒后强制退出
  setTimeout(() => {
    logger.error('无法优雅关闭，强制退出');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 捕获未处理的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝:', reason);
});

// 捕获未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error);
  process.exit(1);
});

export default app;
