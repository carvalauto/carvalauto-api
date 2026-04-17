/**
 * 基础测试
 * 
 * 运行: npm test
 */

import { jest } from '@jest/globals';

// Mock 配置
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

// Mock logger
jest.mock('../src/services/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  },
  logAudit: jest.fn(),
  logSecurity: jest.fn()
}));

describe('API 基础测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('应该导出正确的模块', async () => {
    const { ApiError } = await import('../src/middleware/errorHandler.js');
    expect(ApiError).toBeDefined();
  });

  test('ApiError 应该正确抛出', () => {
    const { ApiError } = require('../src/middleware/errorHandler.js');
    
    const error = new ApiError(404, '测试错误', 'TEST_ERROR');
    
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('测试错误');
    expect(error.code).toBe('TEST_ERROR');
  });

  test('CORS 配置应该正确导出', async () => {
    const { corsOptions } = await import('../src/middleware/cors.js');
    
    expect(corsOptions.methods).toContain('GET');
    expect(corsOptions.methods).toContain('POST');
    expect(corsOptions.methods).toContain('PUT');
    expect(corsOptions.methods).toContain('DELETE');
  });
});

describe('工具函数测试', () => {
  test('isValidUrl 应该正确验证 URL', async () => {
    const { isValidUrl } = await import('../src/utils/validators.js');
    
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com')).toBe(true);
    expect(isValidUrl('invalid-url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });

  test('validateId 应该正确验证 ID', async () => {
    const { validateId } = await import('../src/utils/validators.js');
    
    expect(validateId('123')).toBe(123);
    expect(() => validateId('-1')).toThrow();
    expect(() => validateId('abc')).toThrow();
  });

  test('sanitizeFilename 应该正确清理文件名', async () => {
    const { sanitizeFilename } = await import('../src/utils/validators.js');
    
    expect(sanitizeFilename('test file.pdf')).toBe('test_file.pdf');
    expect(sanitizeFilename('file with spaces.pdf')).toBe('file_with_spaces.pdf');
  });
});
