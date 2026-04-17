/**
 * 错误处理中间件
 * 
 * 统一处理所有错误，提供一致的错误响应格式
 */

import { logger } from '../services/logger.js';

/**
 * 自定义 API 错误类
 */
export class ApiError extends Error {
  constructor(statusCode, message, code = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 未找到处理
 */
export const notFoundHandler = (req, res, next) => {
  const error = new ApiError(404, `路由 ${req.originalUrl} 未找到`);
  next(error);
};

/**
 * 全局错误处理
 */
export const errorHandler = (err, req, res, next) => {
  // 记录错误日志
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // 默认错误值
  let statusCode = err.statusCode || 500;
  let message = err.message || '服务器内部错误';
  let code = err.code || 'INTERNAL_ERROR';
  let details = err.details || null;

  // 处理特定类型的错误
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = '无效的认证令牌';
    code = 'INVALID_TOKEN';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = '认证令牌已过期';
    code = 'TOKEN_EXPIRED';
  }

  // CORS 错误
  if (err.message && err.message.includes('CORS')) {
    statusCode = 403;
    message = '跨域请求被拒绝';
    code = 'CORS_ERROR';
  }

  // GitHub API 错误
  if (err.status === 403 || err.status === 401) {
    statusCode = err.status;
    code = 'AUTH_ERROR';
    message = '认证或授权失败';
  }

  if (err.status === 404) {
    statusCode = 404;
    code = 'NOT_FOUND';
  }

  // 构建错误响应
  const errorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      ...(details && { details })
    },
    timestamp: new Date().toISOString()
  };

  // 在开发环境下添加更多信息
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.path = req.path;
    errorResponse.error.method = req.method;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 异步处理器包装
 * 用于包装异步路由处理器，自动捕获错误
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
