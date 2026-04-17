/**
 * 产品服务
 * 
 * 提供产品数据的 CRUD 操作
 */

import { githubService } from './github.js';
import { logger } from './logger.js';
import { ApiError } from '../middleware/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';

class ProductService {
  constructor() {
    this.cache = null;
    this.cacheSha = null;
    this.cacheTime = null;
    this.CACHE_TTL = 60000; // 1 分钟缓存
  }

  /**
   * 获取缓存的产品数据
   */
  async getProducts(token, forceRefresh = false) {
    // 检查缓存
    if (!forceRefresh && this.cache && this.cacheTime) {
      const elapsed = Date.now() - this.cacheTime;
      if (elapsed < this.CACHE_TTL) {
        logger.debug('使用缓存的产品数据');
        return {
          products: this.cache,
          sha: this.cacheSha,
          fromCache: true
        };
      }
    }

    // 从 GitHub 获取
    const result = await githubService.getProducts(token);
    
    // 更新缓存
    this.cache = result.products;
    this.cacheSha = result.sha;
    this.cacheTime = Date.now();

    return {
      products: result.products,
      sha: result.sha,
      fromCache: false
    };
  }

  /**
   * 获取单个产品
   */
  async getProduct(id, token) {
    const { products } = await this.getProducts(token);
    
    const product = products.find(p => 
      String(p.id) === String(id) || 
      p.id === parseInt(id)
    );

    if (!product) {
      throw new ApiError(404, `产品 ID ${id} 不存在`, 'PRODUCT_NOT_FOUND');
    }

    return product;
  }

  /**
   * 搜索产品
   */
  async searchProducts(params, token) {
    const { products } = await this.getProducts(token);
    const {
      search = '',
      category = null,
      page = 1,
      limit = 20,
      sortBy = 'id',
      sortOrder = 'asc'
    } = params;

    let filtered = [...products];

    // 搜索过滤
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(p => 
        (p.name || '').toLowerCase().includes(searchLower) ||
        (p.title || '').toLowerCase().includes(searchLower) ||
        (p.oem || '').toLowerCase().includes(searchLower) ||
        (p.oemCode || '').toLowerCase().includes(searchLower) ||
        (p.category || '').toLowerCase().includes(searchLower) ||
        (p.description || '').toLowerCase().includes(searchLower)
      );
    }

    // 分类过滤
    if (category && category !== 'all') {
      filtered = filtered.filter(p => 
        (p.category || 'other').toLowerCase() === category.toLowerCase()
      );
    }

    // 排序
    filtered.sort((a, b) => {
      let aVal = a[sortBy] || '';
      let bVal = b[sortBy] || '';
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (sortOrder === 'desc') {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    });

    // 分页
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedProducts = filtered.slice(startIndex, startIndex + limit);

    // 获取分类统计
    const categoryStats = this.getCategoryStats(products);

    return {
      products: paginatedProducts,
      pagination: {
        total,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit),
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: {
        search,
        category
      },
      categoryStats
    };
  }

  /**
   * 获取分类统计
   */
  getCategoryStats(products) {
    const stats = {
      all: products.length,
      japanese: 0,
      korean: 0,
      german: 0,
      chinese: 0,
      american: 0,
      oil: 0,
      other: 0
    };

    products.forEach(p => {
      const cat = (p.category || 'other').toLowerCase();
      if (stats.hasOwnProperty(cat)) {
        stats[cat]++;
      } else {
        stats.other++;
      }
    });

    return stats;
  }

  /**
   * 创建产品
   */
  async createProduct(data, token) {
    const { products, sha } = await this.getProducts(token);

    // 生成新 ID
    const maxId = products.reduce((max, p) => Math.max(max, parseInt(p.id) || 0), 0);
    const newId = maxId + 1;

    // 创建新产品
    const newProduct = {
      id: newId,
      name: data.name || data.title || '',
      title: data.title || data.name || '',
      category: (data.category || 'other').toLowerCase(),
      oem: data.oem || data.oemCode || '',
      oemCode: data.oemCode || data.oem || '',
      url: data.url || '',
      description: data.description || '',
      images: Array.isArray(data.images) ? data.images : 
              (data.image ? data.image.split(',').map(s => s.trim()) : []),
      image: Array.isArray(data.images) ? data.images.join(',') : 
             (data.image || ''),
      fitmentTable: data.fitmentTable || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 添加到数组开头
    products.unshift(newProduct);

    // 保存到 GitHub
    await githubService.saveProducts(products, sha, token);

    // 清除缓存
    this.clearCache();

    logger.info(`产品创建成功: ID ${newId}`);

    return {
      product: newProduct,
      totalProducts: products.length
    };
  }

  /**
   * 更新产品
   */
  async updateProduct(id, data, token) {
    const { products, sha } = await this.getProducts(token);

    const index = products.findIndex(p => 
      String(p.id) === String(id) || 
      p.id === parseInt(id)
    );

    if (index === -1) {
      throw new ApiError(404, `产品 ID ${id} 不存在`, 'PRODUCT_NOT_FOUND');
    }

    // 更新产品
    const updatedProduct = {
      ...products[index],
      ...data,
      id: products[index].id, // 保持原 ID
      updatedAt: new Date().toISOString()
    };

    // 确保字段一致性
    if (data.name) updatedProduct.title = data.name;
    if (data.title) updatedProduct.name = data.title;
    if (data.oem) updatedProduct.oemCode = data.oem;
    if (data.oemCode) updatedProduct.oem = data.oemCode;
    if (data.images) {
      updatedProduct.images = data.images;
      updatedProduct.image = data.images.join(',');
    }
    if (data.image && !data.images) {
      updatedProduct.images = data.image.split(',').map(s => s.trim());
      updatedProduct.image = data.image;
    }

    products[index] = updatedProduct;

    // 保存到 GitHub
    await githubService.saveProducts(products, sha, token);

    // 清除缓存
    this.clearCache();

    logger.info(`产品更新成功: ID ${id}`);

    return {
      product: updatedProduct,
      totalProducts: products.length
    };
  }

  /**
   * 删除产品
   */
  async deleteProduct(id, token) {
    const { products, sha } = await this.getProducts(token);

    const index = products.findIndex(p => 
      String(p.id) === String(id) || 
      p.id === parseInt(id)
    );

    if (index === -1) {
      throw new ApiError(404, `产品 ID ${id} 不存在`, 'PRODUCT_NOT_FOUND');
    }

    const deletedProduct = products[index];

    // 从数组中移除
    products.splice(index, 1);

    // 保存到 GitHub
    await githubService.saveProducts(products, sha, token);

    // 清除缓存
    this.clearCache();

    logger.info(`产品删除成功: ID ${id}`);

    return {
      deleted: deletedProduct,
      totalProducts: products.length
    };
  }

  /**
   * 批量删除产品
   */
  async batchDelete(ids, token) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, '请提供要删除的产品 ID 列表', 'INVALID_IDS');
    }

    const { products, sha } = await this.getProducts(token);

    const idSet = new Set(ids.map(id => String(id)));
    const deleted = [];
    const notFound = [];

    // 过滤要删除的产品
    const remaining = products.filter(p => {
      if (idSet.has(String(p.id))) {
        deleted.push(p);
        return false;
      }
      return true;
    });

    // 检查未找到的产品
    ids.forEach(id => {
      if (!idSet.has(String(id))) {
        notFound.push(id);
      }
    });

    if (deleted.length === 0) {
      throw new ApiError(404, '未找到要删除的产品', 'NO_PRODUCTS_FOUND');
    }

    // 保存到 GitHub
    await githubService.saveProducts(remaining, sha, token);

    // 清除缓存
    this.clearCache();

    logger.info(`批量删除成功: 删除了 ${deleted.length} 个产品`);

    return {
      deleted: deleted.map(p => p.id),
      deletedCount: deleted.length,
      notFound,
      totalProducts: remaining.length
    };
  }

  /**
   * 批量添加产品
   */
  async batchCreate(productsData, token) {
    if (!Array.isArray(productsData) || productsData.length === 0) {
      throw new ApiError(400, '请提供产品数据列表', 'INVALID_DATA');
    }

    const { products, sha } = await this.getProducts(token);

    // 获取最大 ID
    const maxId = products.reduce((max, p) => Math.max(max, parseInt(p.id) || 0), 0);

    const newProducts = productsData.map((data, index) => ({
      id: maxId + index + 1,
      name: data.name || data.title || '',
      title: data.title || data.name || '',
      category: (data.category || 'other').toLowerCase(),
      oem: data.oem || data.oemCode || '',
      oemCode: data.oemCode || data.oem || '',
      url: data.url || '',
      description: data.description || '',
      images: Array.isArray(data.images) ? data.images : 
              (data.image ? data.image.split(',').map(s => s.trim()) : []),
      image: Array.isArray(data.images) ? data.images.join(',') : 
             (data.image || ''),
      fitmentTable: data.fitmentTable || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    // 添加到数组开头
    products.unshift(...newProducts);

    // 保存到 GitHub
    await githubService.saveProducts(products, sha, token);

    // 清除缓存
    this.clearCache();

    logger.info(`批量创建成功: 添加了 ${newProducts.length} 个产品`);

    return {
      products: newProducts,
      addedCount: newProducts.length,
      totalProducts: products.length
    };
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache = null;
    this.cacheSha = null;
    this.cacheTime = null;
    logger.debug('产品缓存已清除');
  }
}

// 导出单例
export const productService = new ProductService();
export default productService;
