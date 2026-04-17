/**
 * 健康检查路由
 * 
 * 提供服务健康状态检查
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { githubService } from '../services/github.js';
import { ossService } from '../services/oss.js';
import { logger } from '../services/logger.js';

const router = Router();

/**
 * GET /api/health
 * 基础健康检查
 */
router.get('/', asyncHandler(async (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'carvalauto-backend',
    version: '1.0.0'
  });
}));

/**
 * GET /api/health/detailed
 * 详细健康检查
 */
router.get('/detailed', asyncHandler(async (req, res) => {
  const checks = {
    github: { status: 'unknown', message: '' },
    oss: { status: 'unknown', message: '' }
  };

  // 检查 GitHub
  try {
    const ghToken = process.env.GH_TOKEN;
    if (ghToken) {
      const isValid = await githubService.validateToken(ghToken);
      checks.github = {
        status: isValid ? 'healthy' : 'unhealthy',
        message: isValid ? 'Token 有效' : 'Token 无效'
      };
    } else {
      checks.github = {
        status: 'not_configured',
        message: 'GitHub Token 未配置'
      };
    }
  } catch (error) {
    checks.github = {
      status: 'unhealthy',
      message: error.message
    };
  }

  // 检查 OSS
  try {
    const isAvailable = await ossService.isAvailable();
    checks.oss = {
      status: isAvailable ? 'healthy' : 'unhealthy',
      message: isAvailable ? 'Bucket 可访问' : 'Bucket 不可访问'
    };
  } catch (error) {
    checks.oss = {
      status: 'unhealthy',
      message: error.message
    };
  }

  // 整体状态
  const overallStatus = Object.values(checks).every(
    c => c.status === 'healthy' || c.status === 'not_configured'
  ) ? 'healthy' : 'degraded';

  res.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'carvalauto-backend',
    version: '1.0.0',
    checks
  });
}));

/**
 * GET /api/health/ready
 * 就绪检查
 */
router.get('/ready', asyncHandler(async (req, res) => {
  try {
    // 检查关键依赖
    if (!process.env.GH_TOKEN) {
      return res.status(503).json({
        status: 'not_ready',
        message: 'GitHub Token 未配置'
      });
    }

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      message: error.message
    });
  }
}));

/**
 * GET /api/health/live
 * 存活检查
 */
router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

export default router;
