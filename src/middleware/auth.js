/**
 * 认证中间件
 * 
 * 提供多种认证方式：
 * 1. API Key 认证（简单）
 * 2. Bearer Token 认证
 * 3. Google OAuth Token 验证
 */

import { config } from 'dotenv';
import { ApiError } from './errorHandler.js';
import { logger } from '../services/logger.js';

config();

/**
 * API Key 认证
 * 用于简单的服务器间认证
 */
export const apiKeyAuth = (req, res, next) => {
  const apiKey = req.get('X-Api-Key');
  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    logger.warn('API Key 未配置，跳过认证');
    return next();
  }

  if (!apiKey) {
    throw new ApiError(401, '缺少 API Key', 'MISSING_API_KEY');
  }

  if (apiKey !== validApiKey) {
    throw new ApiError(403, '无效的 API Key', 'INVALID_API_KEY');
  }

  next();
};

/**
 * Bearer Token 认证
 * 用于用户身份验证
 */
export const bearerAuth = async (req, res, next) => {
  const authHeader = req.get('Authorization');

  if (!authHeader) {
    throw new ApiError(401, '缺少认证信息', 'MISSING_AUTH');
  }

  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new ApiError(401, '无效的认证格式', 'INVALID_AUTH_FORMAT');
  }

  const token = parts[1];

  try {
    // 验证 token（这里可以集成 JWT 验证逻辑）
    const user = await verifyToken(token);
    
    if (!user) {
      throw new ApiError(401, '无效的认证令牌', 'INVALID_TOKEN');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(401, '认证失败', 'AUTH_FAILED');
  }
};

/**
 * GitHub Token 认证
 * 用于 GitHub API 操作
 */
export const githubAuth = (req, res, next) => {
  const authHeader = req.get('Authorization');

  if (!authHeader) {
    throw new ApiError(401, '缺少 GitHub Token', 'MISSING_GITHUB_TOKEN');
  }

  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'token') {
    throw new ApiError(401, '无效的 GitHub Token 格式', 'INVALID_TOKEN_FORMAT');
  }

  const token = parts[1];

  // 验证 token 格式（简单检查）
  if (token.length < 10) {
    throw new ApiError(401, '无效的 GitHub Token', 'INVALID_TOKEN');
  }

  req.githubToken = token;
  next();
};

/**
 * Google OAuth Token 验证
 */
export const googleOAuth = async (req, res, next) => {
  const authHeader = req.get('Authorization');

  if (!authHeader) {
    throw new ApiError(401, '缺少 Google Token', 'MISSING_GOOGLE_TOKEN');
  }

  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new ApiError(401, '无效的认证格式', 'INVALID_AUTH_FORMAT');
  }

  const idToken = parts[1];

  try {
    // 验证 Google ID Token
    const user = await verifyGoogleToken(idToken);
    
    if (!user) {
      throw new ApiError(401, '无效的 Google Token', 'INVALID_GOOGLE_TOKEN');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(401, 'Google 认证失败', 'GOOGLE_AUTH_FAILED');
  }
};

/**
 * 可选认证
 * 如果有认证信息则验证，没有则继续
 */
export const optionalAuth = async (req, res, next) => {
  const authHeader = req.get('Authorization');

  if (!authHeader) {
    return next();
  }

  // 尝试验证
  try {
    await bearerAuth(req, res, next);
  } catch (error) {
    // 忽略错误，继续处理
    logger.warn('可选认证失败，继续处理', error.message);
    next();
  }
};

/**
 * 管理员认证
 * 验证用户是否有管理员权限
 */
export const adminAuth = async (req, res, next) => {
  // 先进行基础认证
  await new Promise((resolve, reject) => {
    bearerAuth(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // 检查管理员权限
  if (!req.user || !req.user.isAdmin) {
    throw new ApiError(403, '需要管理员权限', 'ADMIN_REQUIRED');
  }

  next();
};

/**
 * 验证通用 Token
 * 占位函数，实际应连接数据库或缓存验证
 */
async function verifyToken(token) {
  // TODO: 实现实际的 token 验证逻辑
  // 这里可以从 Redis、数据库等存储中验证 token
  
  // 示例：检查 token 格式
  if (token && token.length >= 20) {
    return {
      id: 'user_1',
      email: 'admin@carvalauto.com',
      isAdmin: true,
      token
    };
  }
  
  return null;
}

/**
 * 验证 Google ID Token
 * 使用 Google API 验证 token
 */
async function verifyGoogleToken(idToken) {
  // Google ID Token 验证
  // 实际实现需要使用 google-auth-library
  
  // 简单检查 token 格式
  if (idToken && idToken.includes('.') && idToken.split('.').length === 3) {
    // TODO: 实际调用 Google API 验证
    // const { OAuth2Client } = require('google-auth-library');
    // const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    // const ticket = await client.verifyIdToken({
    //   idToken,
    //   audience: process.env.GOOGLE_CLIENT_ID
    // });
    // const payload = ticket.getPayload();
    
    return {
      id: 'google_user_1',
      email: 'user@gmail.com',
      name: 'Admin',
      isAdmin: true
    };
  }
  
  return null;
}
