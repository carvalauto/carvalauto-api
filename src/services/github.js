/**
 * GitHub API 服务
 * 
 * 提供与 GitHub 仓库交互的功能
 */

import { Octokit } from '@octokit/rest';
import { config } from 'dotenv';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from './logger.js';

config();

class GitHubService {
  constructor() {
    this.repo = process.env.GH_REPO || 'carvalauto/carvalauto.github.io';
    this.branch = process.env.GH_BRANCH || 'main';
    this.client = null;
  }

  /**
   * 初始化 Octokit 客户端
   */
  initClient(token) {
    this.client = new Octokit({
      auth: token,
      userAgent: 'carvalauto-backend v1.0'
    });
    return this;
  }

  /**
   * 确保客户端已初始化
   */
  ensureClient(token) {
    if (!this.client) {
      this.initClient(token);
    }
    return this.client;
  }

  /**
   * 获取文件内容
   */
  async getFile(path, token) {
    try {
      const octokit = this.ensureClient(token);
      const [owner, repo] = this.repo.split('/');

      const response = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: this.branch
      });

      // 解码 base64 内容
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');

      return {
        content,
        sha: response.data.sha,
        path: response.data.path,
        size: response.data.size
      };
    } catch (error) {
      if (error.status === 404) {
        throw new ApiError(404, `文件 ${path} 不存在`, 'FILE_NOT_FOUND');
      }
      logger.error('GitHub getFile 错误:', error);
      throw new ApiError(error.status || 500, '获取文件失败', 'GITHUB_ERROR');
    }
  }

  /**
   * 更新文件内容
   */
  async updateFile(path, content, sha, message, token) {
    try {
      const octokit = this.ensureClient(token);
      const [owner, repo] = this.repo.split('/');

      const response = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: message || `Update ${path} - ${new Date().toISOString()}`,
        content: Buffer.from(content).toString('base64'),
        sha,
        branch: this.branch
      });

      logger.info(`文件更新成功: ${path}`);
      
      return {
        commit: response.data.commit,
        content: response.data.content
      };
    } catch (error) {
      logger.error('GitHub updateFile 错误:', error);
      
      if (error.status === 409) {
        throw new ApiError(409, '文件冲突，请重新获取最新版本', 'FILE_CONFLICT');
      }
      
      throw new ApiError(error.status || 500, '更新文件失败', 'GITHUB_ERROR');
    }
  }

  /**
   * 创建新文件
   */
  async createFile(path, content, message, token) {
    try {
      const octokit = this.ensureClient(token);
      const [owner, repo] = this.repo.split('/');

      const response = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: message || `Create ${path} - ${new Date().toISOString()}`,
        content: Buffer.from(content).toString('base64'),
        branch: this.branch
      });

      logger.info(`文件创建成功: ${path}`);
      
      return {
        commit: response.data.commit,
        content: response.data.content
      };
    } catch (error) {
      logger.error('GitHub createFile 错误:', error);
      throw new ApiError(error.status || 500, '创建文件失败', 'GITHUB_ERROR');
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(path, sha, message, token) {
    try {
      const octokit = this.ensureClient(token);
      const [owner, repo] = this.repo.split('/');

      await octokit.repos.deleteFile({
        owner,
        repo,
        path,
        message: message || `Delete ${path} - ${new Date().toISOString()}`,
        sha,
        branch: this.branch
      });

      logger.info(`文件删除成功: ${path}`);
      
      return { success: true };
    } catch (error) {
      logger.error('GitHub deleteFile 错误:', error);
      throw new ApiError(error.status || 500, '删除文件失败', 'GITHUB_ERROR');
    }
  }

  /**
   * 获取产品数据
   */
  async getProducts(token) {
    const result = await this.getFile('products.json', token);
    return {
      products: JSON.parse(result.content),
      sha: result.sha
    };
  }

  /**
   * 保存产品数据
   */
  async saveProducts(products, sha, token) {
    const content = JSON.stringify(products, null, 2);
    return this.updateFile(
      'products.json',
      content,
      sha,
      `Update products - ${new Date().toISOString()} via API`,
      token
    );
  }

  /**
   * 获取版本信息
   */
  async getVersion(token) {
    try {
      const result = await this.getFile('version.json', token);
      return JSON.parse(result.content);
    } catch (error) {
      if (error.code === 'FILE_NOT_FOUND') {
        return { version: '1.0.0', updatedAt: new Date().toISOString() };
      }
      throw error;
    }
  }

  /**
   * 更新版本信息
   */
  async saveVersion(version, sha, token) {
    const content = JSON.stringify(version, null, 2);
    return this.updateFile(
      'version.json',
      content,
      sha,
      `Update version - ${new Date().toISOString()} via API`,
      token
    );
  }

  /**
   * 验证 token 有效性
   */
  async validateToken(token) {
    try {
      const octokit = this.ensureClient(token);
      await octokit.users.getAuthenticated();
      return true;
    } catch (error) {
      logger.warn('GitHub token 验证失败:', error.message);
      return false;
    }
  }
}

// 导出单例
export const githubService = new GitHubService();
export default githubService;
