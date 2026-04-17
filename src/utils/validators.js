/**
 * 验证工具函数
 */

import { ApiError } from '../middleware/errorHandler.js';

/**
 * 验证产品数据
 */
export function validateProduct(data, isUpdate = false) {
  const errors = [];

  // 更新时部分字段可选
  if (!isUpdate) {
    if (!data.name && !data.title) {
      errors.push('产品名称不能为空');
    }
  }

  // 验证分类
  const validCategories = ['japanese', 'korean', 'german', 'chinese', 'american', 'oil', 'other'];
  if (data.category && !validCategories.includes(data.category.toLowerCase())) {
    errors.push(`分类必须是: ${validCategories.join(', ')}`);
  }

  // 验证图片格式
  if (data.images) {
    if (!Array.isArray(data.images)) {
      errors.push('images 必须是数组');
    } else {
      const invalidUrls = data.images.filter(url => !isValidUrl(url));
      if (invalidUrls.length > 0) {
        errors.push('部分图片 URL 格式无效');
      }
    }
  }

  // 验证单个图片
  if (data.image && typeof data.image === 'string') {
    const urls = data.image.split(',');
    const invalidUrls = urls.filter(url => !isValidUrl(url.trim()));
    if (invalidUrls.length > 0) {
      errors.push('部分图片 URL 格式无效');
    }
  }

  // OEM 编码格式检查
  if (data.oem && typeof data.oem !== 'string') {
    errors.push('OEM 编码必须是字符串');
  }

  if (errors.length > 0) {
    throw new ApiError(400, errors.join('; '), 'VALIDATION_ERROR', { errors });
  }

  return true;
}

/**
 * 验证 URL 格式
 */
export function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 验证 ID
 */
export function validateId(id) {
  const numId = parseInt(id);
  if (isNaN(numId) || numId <= 0) {
    throw new ApiError(400, '无效的 ID', 'INVALID_ID');
  }
  return numId;
}

/**
 * 验证分页参数
 */
export function validatePagination(query) {
  const page = parseInt(query.page) || 1;
  const limit = Math.min(parseInt(query.limit) || 20, 100);
  const sortBy = query.sortBy || 'id';
  const sortOrder = ['asc', 'desc'].includes(query.sortOrder) ? query.sortOrder : 'asc';

  return {
    page: Math.max(1, page),
    limit: Math.max(1, limit),
    sortBy,
    sortOrder
  };
}

/**
 * 清理产品数据
 */
export function sanitizeProduct(data) {
  const sanitized = {};

  // 允许的字段
  const allowedFields = [
    'name', 'title', 'category', 'oem', 'oemCode',
    'url', 'description', 'image', 'images', 'fitmentTable'
  ];

  allowedFields.forEach(field => {
    if (data[field] !== undefined) {
      sanitized[field] = data[field];
    }
  });

  // 规范化分类
  if (sanitized.category) {
    sanitized.category = sanitized.category.toLowerCase();
  }

  // 规范化图片
  if (typeof sanitized.image === 'string') {
    sanitized.images = sanitized.image.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (Array.isArray(sanitized.images) && typeof sanitized.image !== 'string') {
    sanitized.image = sanitized.images.join(',');
  }

  return sanitized;
}

/**
 * 生成安全的文件名
 */
export function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-z0-9.-]/gi, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
}

/**
 * 检查对象是否为空
 */
export function isEmpty(obj) {
  if (obj === null || obj === undefined) return true;
  if (typeof obj === 'string') return obj.trim() === '';
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
}

/**
 * 深拷贝对象
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (obj instanceof Object) {
    const cloned = {};
    Object.keys(obj).forEach(key => {
      cloned[key] = deepClone(obj[key]);
    });
    return cloned;
  }
  return obj;
}

/**
 * 防抖函数
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 限流函数
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
