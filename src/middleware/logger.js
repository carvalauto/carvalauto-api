/**
 * 请求日志中间件
 * 
 * 记录所有传入的请求信息
 */

import { logger } from '../services/logger.js';

/**
 * 请求日志处理
 */
export const requestLogger = (req, res, next) => {
  // 请求开始时间
  const startTime = Date.now();
  
  // 请求基本信息
  const requestInfo = {
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    query: req.query,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent'),
    contentLength: req.get('content-length') || 0
  };

  // 移除敏感信息
  if (req.body && req.body.password) {
    requestInfo.body = { ...req.body, password: '[REDACTED]' };
  }
  if (req.body && req.body.token) {
    requestInfo.body = { ...(requestInfo.body || req.body), token: '[REDACTED]' };
  }

  // 记录请求
  logger.info({
    type: 'REQUEST',
    ...requestInfo
  });

  // 响应完成后的处理
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    const responseInfo = {
      type: 'RESPONSE',
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    };

    // 根据状态码选择日志级别
    if (res.statusCode >= 500) {
      logger.error(responseInfo);
    } else if (res.statusCode >= 400) {
      logger.warn(responseInfo);
    } else {
      logger.info(responseInfo);
    }
  });

  next();
};
