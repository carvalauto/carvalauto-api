/**
 * CORS 中间件配置
 * 
 * 配置允许的源，防止跨域攻击
 */

import { config } from 'dotenv';
config();

/**
 * CORS 配置选项
 */
export const corsOptions = {
  // 允许的源
  origin: (origin, callback) => {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://carvalautopart.com')
      .split(',')
      .map(o => o.trim());
    
    // 允许没有 origin 的请求（如 Postman、curl）
    if (!origin) {
      return callback(null, true);
    }
    
    // 检查 origin 是否在白名单中
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed`), false);
    }
  },
  
  // 允许的 HTTP 方法
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  
  // 允许的请求头
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-Api-Key'
  ],
  
  // 允许暴露的头
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  
  // 是否允许携带凭证
  credentials: true,
  
  // 预检请求缓存时间
  maxAge: 86400, // 24 小时
  
  // 是否返回 OPTIONS 请求
  optionsSuccessStatus: 204
};

/**
 * CORS 预检请求处理
 */
export const handlePreflight = (req, res) => {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://carvalautopart.com')
    .split(',')
    .map(o => o.trim());
  
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
  res.setHeader('Access-Control-Allow-Credentials', corsOptions.credentials);
  res.setHeader('Access-Control-Max-Age', corsOptions.maxAge);
  
  res.status(204).end();
};
