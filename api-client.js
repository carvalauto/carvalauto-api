/**
 * Carval Auto API 客户端
 * 
 * 用于前端调用的 API 封装
 * 替换原有的直接 OSS 操作，保护密钥安全
 * 
 * @version 1.0.0
 */

class CarvalAPI {
  constructor(options = {}) {
    this.baseURL = options.baseURL || '';
    this.githubToken = options.githubToken || localStorage.getItem('gh_token') || '';
    this.apiKey = options.apiKey || '';
    this.defaultTimeout = options.timeout || 30000;
    
    // 缓存
    this.cache = {
      products: null,
      productsSha: null,
      timestamp: null
    };
    this.cacheTTL = 60000; // 1 分钟缓存
  }

  /**
   * 获取请求头
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (this.githubToken) {
      headers['Authorization'] = `token ${this.githubToken}`;
    }

    if (this.apiKey) {
      headers['X-Api-Key'] = this.apiKey;
    }

    return headers;
  }

  /**
   * 发送请求
   */
  async request(endpoint, options = {}) {
    const url = this.baseURL + endpoint;
    
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers
      },
      timeout: options.timeout || this.defaultTimeout
    };

    try {
      const response = await fetch(url, config);
      
      // 检查响应状态
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new APIError(
          error.error?.message || error.message || `HTTP ${response.status}`,
          response.status,
          error.error?.code || 'REQUEST_FAILED'
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      // 处理网络错误
      if (error.name === 'AbortError') {
        throw new APIError('请求超时', 408, 'TIMEOUT');
      }
      
      throw new APIError(
        error.message || '网络错误',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  // ==================== 健康检查 ====================

  /**
   * 基础健康检查
   */
  async healthCheck() {
    return this.request('/api/health');
  }

  /**
   * 详细健康检查
   */
  async healthCheckDetailed() {
    return this.request('/api/health/detailed');
  }

  // ==================== 产品 API ====================

  /**
   * 获取产品列表
   */
  async getProducts(params = {}) {
    const queryParams = new URLSearchParams();
    
    if (params.search) queryParams.set('search', params.search);
    if (params.category) queryParams.set('category', params.category);
    if (params.page) queryParams.set('page', params.page);
    if (params.limit) queryParams.set('limit', params.limit);
    if (params.sortBy) queryParams.set('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);

    const query = queryParams.toString();
    const endpoint = '/api/products' + (query ? `?${query}` : '');

    return this.request(endpoint);
  }

  /**
   * 获取单个产品
   */
  async getProduct(id) {
    return this.request(`/api/products/${id}`);
  }

  /**
   * 创建产品
   */
  async createProduct(data) {
    return this.request('/api/products', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * 更新产品
   */
  async updateProduct(id, data) {
    return this.request(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * 删除产品
   */
  async deleteProduct(id, confirm = true) {
    return this.request(`/api/products/${id}?confirm=${confirm}`, {
      method: 'DELETE'
    });
  }

  /**
   * 批量删除产品
   */
  async batchDelete(ids, confirm = true) {
    return this.request(`/api/products/batch-delete?confirm=${confirm}`, {
      method: 'POST',
      body: JSON.stringify({ ids })
    });
  }

  /**
   * 批量创建产品
   */
  async batchCreate(products) {
    return this.request('/api/products/batch-create', {
      method: 'POST',
      body: JSON.stringify({ products })
    });
  }

  /**
   * 获取产品统计
   */
  async getProductStats() {
    return this.request('/api/products/stats/summary');
  }

  /**
   * 刷新产品缓存
   */
  async refreshProducts() {
    return this.request('/api/products/refresh', {
      method: 'POST'
    });
  }

  // ==================== 同步 API ====================

  /**
   * 同步数据
   */
  async syncData() {
    return this.request('/api/sync', {
      method: 'POST'
    });
  }

  /**
   * 获取同步状态
   */
  async getSyncStatus() {
    return this.request('/api/sync/status');
  }

  /**
   * 验证数据完整性
   */
  async verifyData() {
    return this.request('/api/sync/verify', {
      method: 'POST'
    });
  }

  /**
   * 修复数据问题
   */
  async fixData() {
    return this.request('/api/sync/fix', {
      method: 'POST'
    });
  }

  // ==================== 工具方法 ====================

  /**
   * 设置 GitHub Token
   */
  setGitHubToken(token) {
    this.githubToken = token;
    localStorage.setItem('gh_token', token);
  }

  /**
   * 清除 GitHub Token
   */
  clearGitHubToken() {
    this.githubToken = '';
    localStorage.removeItem('gh_token');
  }

  /**
   * 检查是否已登录
   */
  isAuthenticated() {
    return !!this.githubToken;
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache = {
      products: null,
      productsSha: null,
      timestamp: null
    };
  }

  /**
   * 检查缓存是否有效
   */
  isCacheValid() {
    if (!this.cache.timestamp) return false;
    return Date.now() - this.cache.timestamp < this.cacheTTL;
  }

  /**
   * 批量操作（带进度回调）
   */
  async batchOperation(operation, items, onProgress) {
    const results = {
      success: [],
      failed: []
    };

    const total = items.length;
    
    for (let i = 0; i < items.length; i++) {
      try {
        const result = await operation(items[i]);
        results.success.push(result);
      } catch (error) {
        results.failed.push({
          item: items[i],
          error: error.message
        });
      }

      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          progress: ((i + 1) / total) * 100,
          results
        });
      }
    }

    return results;
  }
}

/**
 * API 错误类
 */
class APIError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
  }
}

// 创建默认实例
const api = new CarvalAPI({
  baseURL: '' // 部署时填入 API 地址
});

// 导出
export { CarvalAPI, APIError };
export default api;
