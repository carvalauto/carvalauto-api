/**
 * 产品管理路由
 * 
 * 提供产品的 CRUD API
 */

import { Router } from 'express';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import { githubAuth } from '../middleware/auth.js';
import { productService } from '../services/product.js';
import { logAudit, logSecurity } from '../services/logger.js';

const router = Router();

/**
 * GET /api/products
 * 获取产品列表（支持搜索、分页、筛选）
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    search,
    category,
    page = 1,
    limit = 20,
    sortBy = 'id',
    sortOrder = 'asc'
  } = req.query;

  // 限制每页数量
  const safeLimit = Math.min(parseInt(limit) || 20, 100);

  const result = await productService.searchProducts({
    search,
    category,
    page: parseInt(page),
    limit: safeLimit,
    sortBy,
    sortOrder
  }, process.env.GH_TOKEN);

  // 设置分页头
  res.setHeader('X-Total-Count', result.pagination.total);
  res.setHeader('X-Page-Count', result.pagination.totalPages);
  res.setHeader('X-Current-Page', result.pagination.currentPage);

  res.json({
    success: true,
    data: result.products,
    pagination: result.pagination,
    filters: result.filters,
    categoryStats: result.categoryStats
  });
}));

/**
 * GET /api/products/:id
 * 获取单个产品详情
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await productService.getProduct(id, process.env.GH_TOKEN);

  res.json({
    success: true,
    data: product
  });
}));

/**
 * POST /api/products
 * 创建新产品
 */
router.post('/', githubAuth, asyncHandler(async (req, res) => {
  const { product, totalProducts } = await productService.createProduct(
    req.body,
    req.githubToken
  );

  // 审计日志
  logAudit('CREATE_PRODUCT', req.user, {
    productId: product.id,
    category: product.category
  });

  res.status(201).json({
    success: true,
    message: '产品创建成功',
    data: product,
    totalProducts
  });
}));

/**
 * PUT /api/products/:id
 * 更新产品
 */
router.put('/:id', githubAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 安全检查：禁止通过 body 修改 id
  if (req.body.id !== undefined) {
    delete req.body.id;
  }

  const { product, totalProducts } = await productService.updateProduct(
    id,
    req.body,
    req.githubToken
  );

  // 审计日志
  logAudit('UPDATE_PRODUCT', req.user, {
    productId: product.id,
    changes: Object.keys(req.body)
  });

  res.json({
    success: true,
    message: '产品更新成功',
    data: product,
    totalProducts
  });
}));

/**
 * DELETE /api/products/:id
 * 删除单个产品
 */
router.delete('/:id', githubAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { confirm } = req.query;

  // 二次确认检查
  if (confirm !== 'true') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CONFIRMATION_REQUIRED',
        message: '删除操作需要二次确认，请添加 ?confirm=true 参数'
      }
    });
  }

  const result = await productService.deleteProduct(id, req.githubToken);

  // 审计日志
  logAudit('DELETE_PRODUCT', req.user, {
    productId: id,
    productName: result.deleted?.name
  });

  res.json({
    success: true,
    message: '产品删除成功',
    deleted: result.deleted,
    totalProducts: result.totalProducts
  });
}));

/**
 * POST /api/products/batch-delete
 * 批量删除产品
 */
router.post('/batch-delete', githubAuth, asyncHandler(async (req, res) => {
  const { ids } = req.body;
  const { confirm } = req.query;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ApiError(400, '请提供要删除的产品 ID 数组', 'INVALID_IDS');
  }

  // 二次确认检查
  if (confirm !== 'true') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CONFIRMATION_REQUIRED',
        message: '批量删除操作需要二次确认，请添加 ?confirm=true 参数',
        pendingDelete: ids.length
      }
    });
  }

  // 安全限制
  if (ids.length > 50) {
    throw new ApiError(400, '单次最多删除 50 个产品', 'TOO_MANY_DELETES');
  }

  const result = await productService.batchDelete(ids, req.githubToken);

  // 审计日志
  logAudit('BATCH_DELETE_PRODUCTS', req.user, {
    deletedIds: result.deleted,
    deletedCount: result.deletedCount
  });

  // 安全警告日志
  if (result.deletedCount > 10) {
    logSecurity('BATCH_DELETE', {
      user: req.user,
      deletedCount: result.deletedCount
    });
  }

  res.json({
    success: true,
    message: `成功删除 ${result.deletedCount} 个产品`,
    deleted: result.deleted,
    notFound: result.notFound,
    totalProducts: result.totalProducts
  });
}));

/**
 * POST /api/products/batch-create
 * 批量创建产品
 */
router.post('/batch-create', githubAuth, asyncHandler(async (req, res) => {
  const { products } = req.body;

  if (!products || !Array.isArray(products) || products.length === 0) {
    throw new ApiError(400, '请提供产品数据数组', 'INVALID_DATA');
  }

  // 安全限制
  if (products.length > 100) {
    throw new ApiError(400, '单次最多创建 100 个产品', 'TOO_MANY_PRODUCTS');
  }

  const result = await productService.batchCreate(products, req.githubToken);

  // 审计日志
  logAudit('BATCH_CREATE_PRODUCTS', req.user, {
    addedCount: result.addedCount
  });

  res.status(201).json({
    success: true,
    message: `成功创建 ${result.addedCount} 个产品`,
    products: result.products,
    totalProducts: result.totalProducts
  });
}));

/**
 * GET /api/products/stats
 * 获取产品统计信息
 */
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const { products } = await productService.getProducts(process.env.GH_TOKEN);

  // 计算统计
  const categoryStats = productService.getCategoryStats(products);

  // 计算最近更新时间
  const sortedByUpdate = [...products].sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt || 0);
    const dateB = new Date(b.updatedAt || b.createdAt || 0);
    return dateB - dateA;
  });

  const lastUpdated = sortedByUpdate[0]?.updatedAt || sortedByUpdate[0]?.createdAt;

  // 按 OEM 统计
  const oemStats = {};
  products.forEach(p => {
    const oem = p.oem || p.oemCode || 'unknown';
    oemStats[oem] = (oemStats[oem] || 0) + 1;
  });

  // 前 10 个热门 OEM
  const topOems = Object.entries(oemStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([oem, count]) => ({ oem, count }));

  res.json({
    success: true,
    data: {
      totalProducts: products.length,
      categoryStats,
      topOems,
      lastUpdated,
      hasImages: products.filter(p => p.images?.length > 0 || p.image).length,
      withoutImages: products.filter(p => !p.images?.length && !p.image).length
    }
  });
}));

/**
 * POST /api/products/refresh
 * 刷新缓存
 */
router.post('/refresh', githubAuth, asyncHandler(async (req, res) => {
  productService.clearCache();
  
  // 重新获取
  const { products, sha } = await productService.getProducts(
    req.githubToken,
    true
  );

  res.json({
    success: true,
    message: '缓存已刷新',
    totalProducts: products.length
  });
}));

export default router;
