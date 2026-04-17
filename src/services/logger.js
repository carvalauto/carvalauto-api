/**
 * Winston 日志服务
 * 
 * 提供统一的日志记录功能
 */

import winston from 'winston';
import { config } from 'dotenv';

config();

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// 自定义日志格式
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  
  // 添加堆栈跟踪
  if (stack) {
    log += `\n${stack}`;
  }
  
  // 添加元数据
  if (Object.keys(metadata).length > 0) {
    log += `\n${JSON.stringify(metadata, null, 2)}`;
  }
  
  return log;
});

// JSON 格式（用于生产环境）
const jsonLogFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  json()
);

// 文本格式（用于开发环境）
const textLogFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  colorize({ all: true }),
  logFormat
);

// 日志级别
const level = process.env.LOG_LEVEL || 'info';

// 创建 logger 实例
export const logger = winston.createLogger({
  level,
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
  },
  format: process.env.NODE_ENV === 'production' ? jsonLogFormat : textLogFormat,
  transports: [
    // 控制台输出
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    }),
    
    // 错误日志文件
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      handleExceptions: true
    }),
    
    // 综合日志文件
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      handleExceptions: true,
      handleRejections: true
    }),
    
    // HTTP 请求日志
    new winston.transports.File({
      filename: 'logs/http.log',
      level: 'http',
      maxsize: 5242880, // 5MB
      maxFiles: 3
    })
  ],
  exitOnError: false,
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: 'logs/exceptions.log',
      maxsize: 5242880
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: 'logs/rejections.log',
      maxsize: 5242880
    })
  ]
});

// 创建专门的审计日志记录器
export const auditLogger = winston.createLogger({
  level: 'info',
  format: jsonLogFormat,
  transports: [
    new winston.transports.File({
      filename: 'logs/audit.log',
      maxsize: 5242880, // 5MB
      maxFiles: 10
    })
  ]
});

/**
 * 记录审计日志
 * 用于记录重要的业务操作
 */
export const logAudit = (action, user, details) => {
  auditLogger.info({
    action,
    user: user?.email || user?.id || 'anonymous',
    userId: user?.id,
    timestamp: new Date().toISOString(),
    details,
    ip: details?.ip
  });
};

/**
 * 记录安全事件
 */
export const logSecurity = (event, details) => {
  logger.warn({
    type: 'SECURITY',
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// 确保日志目录存在
import fs from 'fs';
const logsDir = 'logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
