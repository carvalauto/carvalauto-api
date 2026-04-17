/**
 * 同步路由
 * 
 * 提供数据同步功能
 */

import { Router } from 'express';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import { githubAuth } from '../middleware/auth.js';
import { githubService } from '../services/github.js';
import { productService } from '../services/product.js';
import { logAudit, logSecurity, logger } from '../services/logger.js';

const router = Router();

/**
 * POST /api/sync
 * 同步产品数据到 OSS（从 GitHub）
 */
router.post('/', githubAuth, asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  // 获取最新数据
  const { products, sha } = await productService.getProducts(
    req.githubToken,
    true // 强制刷新
  );

  // 更新版本信息
  const versionInfo = {
    version: generateVersion(),
    updatedAt: new Date().toISOString(),
    totalProducts: products.length,
    source: 'github_sync'
  };

  try {
    // 获取当前版本 SHA
    const currentVersion = await githubService.getVersion(req.githubToken);
    
    // 更新版本文件
    await githubService.saveVersion(
      versionInfo,
      currentVersion.sha,
      req.githubToken
    );

    logger.info(`版本信息更新成功: ${versionInfo.version}`);
  } catch (error) {
    // 版本文件不存在时创建
    if (error.code === 'FILE_NOT_FOUND') {
      await githubService.createFile(
        'version.json',
        JSON.stringify(versionInfo, null, 2),
        `Create version.json - ${new Date().toISOString()}`,
        req.githubToken
      );
    } else {
      throw error;
    }
  }

  const duration = Date.now() - startTime;

  // 审计日志
  logAudit('SYNC_PRODUCTS', req.user, {
    totalProducts: products.length,
    duration: `${duration}ms`,
    version: versionInfo.version
  });

  res.json({
    success: true,
    message: '同步成功',
    data: {
      totalProducts: products.length,
      version: versionInfo.version,
      updatedAt: versionInfo.updatedAt,
      duration: `${duration}ms`
    }
  });
}));

/**
 * GET /api/sync/status
 * 获取同步状态
 */
router.get('/status', asyncHandler(async (req, res) => {
  // 获取 GitHub 数据
  const ghData = await githubService.getProducts(process.env.GH_TOKEN);
  
  // 获取版本信息
  let versionInfo;
  try {
    versionInfo = await githubService.getVersion(process.env.GH_TOKEN);
  } catch (error) {
    versionInfo = {
      version: 'unknown',
      updatedAt: null
    };
  }

  // 分类统计
  const categoryStats = productService.getCategoryStats(ghData.products);

  res.json({
    success: true,
    data: {
      github: {
        lastUpdated: versionInfo.updatedAt,
        sha: ghData.sha,
        productCount: ghData.products.length
      },
      version: versionInfo.version,
      categoryStats,
      syncRequired: false,
      recommendations: []
    }
  });
}));

/**
 * POST /api/sync/verify
 * 验证数据完整性
 */
router.post('/verify', githubAuth, asyncHandler(async (req, res) => {
  const { products } = await productService.getProducts(req.githubToken);

  const issues = [];
  let validCount = 0;

  // 检查每个产品
  products.forEach((product, index) => {
    const productIssues = [];

    // 检查必填字段
    if (!product.id) {
      productIssues.push('缺少 ID');
    }

    if (!product.name && !product.title) {
      productIssues.push('缺少名称');
    }

    // 检查图片
    if (!product.images?.length && !product.image) {
      productIssues.push('缺少图片');
    }

    // 检查分类
    if (!product.category) {
      productIssues.push('缺少分类');
    }

    if (productIssues.length > 0) {
      issues.push({
        id: product.id || `index_${index}`,
        name: product.name || product.title || '未知',
        issues: productIssues
      });
    } else {
      validCount++;
    }
  });

  res.json({
    success: true,
    data: {
      total: products.length,
      valid: validCount,
      invalid: issues.length,
      healthPercentage: ((validCount / products.length) * 100).toFixed(1),
      issues: issues.slice(0, 50) // 最多返回 50 个问题
    }
  });
}));

/**
 * POST /api/sync/fix
 * 修复常见数据问题
 */
router.post('/fix', githubAuth, asyncHandler(async (req, res) => {
  const { products, sha } = await productService.getProducts(req.githubToken);
  const fixes = [];

  products.forEach(product => {
    let hasFix = false;

    // 修复 1: 确保 name 和 title 一致
    if (product.name && !product.title) {
      product.title = product.name;
      hasFix = true;
    }
    if (product.title && !product.name) {
      product.name = product.title;
      hasFix = true;
    }

    // 修复 2: 确保 oem 和 oemCode 一致
    if (product.oem && !product.oemCode) {
      product.oemCode = product.oem;
      hasFix = true;
    }
    if (product.oemCode && !product.oem) {
      product.oem = product.oemCode;
      hasFix = true;
    }

    // 修复 3: 确保 images 和 image 一致
    if (product.image && !product.images) {
      product.images = product.image.split(',').map(s => s.trim());
      hasFix = true;
    }
    if (product.images?.length && !product.image) {
      product.image = product.images.join(',');
      hasFix = true;
    }

    // 修复 4: 确保分类小写
    if (product.category && product.category !== product.category.toLowerCase()) {
      product.category = product.category.toLowerCase();
      hasFix = true;
    }

    // 修复 5: 添加 updatedAt
    if (!product.updatedAt) {
      product.updatedAt = product.createdAt || new Date().toISOString();
      hasFix = true;
    }

    if (hasFix) {
      product.updatedAt = new Date().toISOString();
      fixes.push({
        id: product.id,
        name: product.name || product.title
      });
    }
  });

  // 保存修复
  if (fixes.length > 0) {
    await githubService.saveProducts(
      products,
      sha,
      req.githubToken,
      `Fix data consistency - ${fixes.length} products`
    );

    productService.clearCache();

    logger.info(`数据修复完成: 修复了 ${fixes.length} 个产品`);
  }

  // 审计日志
  logAudit('FIX_PRODUCTS', req.user, {
    fixedCount: fixes.length
  });

  res.json({
    success: true,
    message: `修复完成，共修复 ${fixes.length} 个产品`,
    data: {
      fixedCount: fixes.length,
      products: fixes
    }
  });
}));

/**
 * 生成版本号
 */
function generateVersion() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  
  return `${year}.${month}.${day}.${hour}${minute}`;
}

export default router;
