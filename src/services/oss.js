/**
 * 阿里云 OSS 服务
 * 
 * 提供与阿里云 OSS 存储交互的功能
 * 
 * 注意：此服务用于直接 OSS 操作
 * 实际产品数据存储在 GitHub，通过 GitHub 服务管理
 */

import OSS from 'ali-oss';
import { config } from 'dotenv';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from './logger.js';

config();

class OSSService {
  constructor() {
    this.region = process.env.OSS_REGION || 'cn-hangzhou';
    this.bucket = process.env.OSS_BUCKET || 'carvalauto-products';
    this.endpoint = process.env.OSS_ENDPOINT || `oss-${this.region}.aliyuncs.com`;
    this.client = null;
  }

  /**
   * 初始化 OSS 客户端
   */
  initClient() {
    if (!process.env.OSS_ACCESS_KEY_ID || !process.env.OSS_ACCESS_KEY_SECRET) {
      throw new ApiError(500, 'OSS 密钥未配置', 'OSS_NOT_CONFIGURED');
    }

    this.client = new OSS({
      region: this.region,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: this.bucket,
      endpoint: this.endpoint,
      // 安全的请求选项
      timeout: 30000,
      retries: 3
    });

    return this.client;
  }

  /**
   * 获取客户端实例
   */
  getClient() {
    if (!this.client) {
      this.initClient();
    }
    return this.client;
  }

  /**
   * 检查 OSS 是否可用
   */
  async isAvailable() {
    try {
      const client = this.getClient();
      await client.headBucket();
      return true;
    } catch (error) {
      logger.warn('OSS 不可用:', error.message);
      return false;
    }
  }

  /**
   * 上传文件
   */
  async put(name, file, options = {}) {
    try {
      const client = this.getClient();
      const result = await client.put(name, file, {
        timeout: 60000,
        ...options
      });

      logger.info(`文件上传成功: ${name}`);
      
      return {
        url: result.url,
        name: result.name,
        res: result.res
      };
    } catch (error) {
      logger.error('OSS 上传错误:', error);
      throw new ApiError(500, `上传文件失败: ${error.message}`, 'OSS_UPLOAD_ERROR');
    }
  }

  /**
   * 上传 Buffer 数据
   */
  async putBuffer(name, buffer, options = {}) {
    try {
      const client = this.getClient();
      const result = await client.put(name, buffer, {
        timeout: 60000,
        contentType: options.contentType || 'application/json',
        ...options
      });

      logger.info(`Buffer 上传成功: ${name}`);
      
      return {
        url: result.url,
        name: result.name
      };
    } catch (error) {
      logger.error('OSS Buffer 上传错误:', error);
      throw new ApiError(500, `上传数据失败: ${error.message}`, 'OSS_UPLOAD_ERROR');
    }
  }

  /**
   * 获取文件
   */
  async get(name) {
    try {
      const client = this.getClient();
      const result = await client.get(name);
      
      return result;
    } catch (error) {
      if (error.name === 'NoSuchKeyError' || error.status === 404) {
        throw new ApiError(404, `文件 ${name} 不存在`, 'FILE_NOT_FOUND');
      }
      logger.error('OSS 获取文件错误:', error);
      throw new ApiError(500, `获取文件失败: ${error.message}`, 'OSS_GET_ERROR');
    }
  }

  /**
   * 获取文件 Buffer
   */
  async getBuffer(name) {
    try {
      const client = this.getClient();
      const result = await client.get(name);
      
      // 读取 buffer
      return new Promise((resolve, reject) => {
        const chunks = [];
        result.stream.on('data', (chunk) => chunks.push(chunk));
        result.stream.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        result.stream.on('error', reject);
      });
    } catch (error) {
      if (error.name === 'NoSuchKeyError' || error.status === 404) {
        throw new ApiError(404, `文件 ${name} 不存在`, 'FILE_NOT_FOUND');
      }
      logger.error('OSS 获取文件 Buffer 错误:', error);
      throw new ApiError(500, `获取文件失败: ${error.message}`, 'OSS_GET_ERROR');
    }
  }

  /**
   * 检查文件是否存在
   */
  async head(name) {
    try {
      const client = this.getClient();
      const result = await client.head(name);
      
      return {
        exists: true,
        meta: result.meta,
        res: result.res
      };
    } catch (error) {
      if (error.status === 404) {
        return { exists: false };
      }
      throw error;
    }
  }

  /**
   * 删除文件
   */
  async delete(name) {
    try {
      const client = this.getClient();
      const result = await client.delete(name);
      
      logger.info(`文件删除成功: ${name}`);
      
      return {
        success: true,
        res: result.res
      };
    } catch (error) {
      logger.error('OSS 删除文件错误:', error);
      throw new ApiError(500, `删除文件失败: ${error.message}`, 'OSS_DELETE_ERROR');
    }
  }

  /**
   * 批量删除文件
   */
  async deleteMulti(names) {
    try {
      const client = this.getClient();
      const result = await client.deleteMulti(names, {
        quiet: true
      });
      
      logger.info(`批量删除文件成功: ${names.length} 个`);
      
      return {
        success: true,
        deleted: result.res.body?.Deleted || [],
        res: result.res
      };
    } catch (error) {
      logger.error('OSS 批量删除文件错误:', error);
      throw new ApiError(500, `批量删除文件失败: ${error.message}`, 'OSS_DELETE_ERROR');
    }
  }

  /**
   * 列出文件
   */
  async list(prefix = '', options = {}) {
    try {
      const client = this.getClient();
      const result = await client.list({
        prefix,
        ...options
      }, {});
      
      return {
        objects: result.objects || [],
        prefixes: result.prefixes || []
      };
    } catch (error) {
      logger.error('OSS 列出文件错误:', error);
      throw new ApiError(500, `列出文件失败: ${error.message}`, 'OSS_LIST_ERROR');
    }
  }

  /**
   * 复制文件
   */
  async copy(source, target) {
    try {
      const client = this.getClient();
      const result = await client.copy(target, source);
      
      logger.info(`文件复制成功: ${source} -> ${target}`);
      
      return {
        success: true,
        res: result.res
      };
    } catch (error) {
      logger.error('OSS 复制文件错误:', error);
      throw new ApiError(500, `复制文件失败: ${error.message}`, 'OSS_COPY_ERROR');
    }
  }

  /**
   * 获取签名 URL
   */
  async signatureUrl(name, options = {}) {
    try {
      const client = this.getClient();
      const url = await client.signatureUrl(name, {
        expires: options.expires || 3600,
        method: options.method || 'GET',
        ...options
      });
      
      return { url };
    } catch (error) {
      logger.error('OSS 生成签名 URL 错误:', error);
      throw new ApiError(500, `生成签名 URL 失败: ${error.message}`, 'OSS_SIGN_ERROR');
    }
  }
}

// 导出单例
export const ossService = new OSSService();
export default ossService;
