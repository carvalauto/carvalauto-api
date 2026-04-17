/**
 * 询盘管理路由
 * 
 * 提供应询盘的 CRUD API
 */

import { Router } from 'express';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import { ossService } from '../services/oss.js';
import { logAudit } from '../services/logger.js';

const router = Router();

/**
 * GET /api/inquiries
 * 获取所有询盘
 */
router.get('/', asyncHandler(async (req, res) => {
  try {
    const result = await ossService.get('inquiries.json');
    const content = result.content.toString('utf-8');
    const inquiries = JSON.parse(content);

    res.json({
      success: true,
      data: inquiries
    });
  } catch (error) {
    // 文件不存在时返回空数组
    if (error.code === 'FILE_NOT_FOUND') {
      res.json({
        success: true,
        data: []
      });
    } else {
      throw error;
    }
  }
}));

/**
 * GET /api/inquiries/:id
 * 获取单个询盘
 */
router.get('/:id', asyncHandler(async (req, res) => {
  try {
    const result = await ossService.get('inquiries.json');
    const content = result.content.toString('utf-8');
    const inquiries = JSON.parse(content);

    const inquiry = inquiries.find(i => String(i.id) === String(req.params.id));

    if (!inquiry) {
      throw new ApiError(404, `询盘 ID ${req.params.id} 不存在`, 'INQUIRY_NOT_FOUND');
    }

    res.json({
      success: true,
      data: inquiry
    });
  } catch (error) {
    if (error.code === 'FILE_NOT_FOUND') {
      throw new ApiError(404, '询盘不存在', 'FILE_NOT_FOUND');
    }
    throw error;
  }
}));

/**
 * POST /api/inquiries
 * 创建新询盘
 */
router.post('/', asyncHandler(async (req, res) => {
  const { name, email, phone, message, product } = req.body;

  if (!name || !email || !message) {
    throw new ApiError(400, '缺少必填字段：姓名、邮箱、消息', 'MISSING_FIELDS');
  }

  try {
    const result = await ossService.get('inquiries.json');
    const content = result.content.toString('utf-8');
    const inquiries = JSON.parse(content);

    // 生成新 ID
    const maxId = inquiries.reduce((max, i) => Math.max(max, parseInt(i.id) || 0), 0);
    const newId = maxId + 1;

    const newInquiry = {
      id: newId,
      name,
      email,
      phone: phone || '',
      message,
      product: product || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    inquiries.unshift(newInquiry);

    // 保存到 OSS
    const newContent = JSON.stringify(inquiries, null, 2);
    await ossService.putBuffer('inquiries.json', Buffer.from(newContent));

    // 审计日志
    logAudit('CREATE_INQUIRY', req.user, {
      inquiryId: newId,
      name: name
    });

    res.status(201).json({
      success: true,
      message: '询盘创建成功',
      data: newInquiry
    });
  } catch (error) {
    // 文件不存在时创建新文件
    if (error.code === 'FILE_NOT_FOUND') {
      const newId = 1;
      const newInquiry = {
        id: newId,
        name,
        email,
        phone: phone || '',
        message,
        product: product || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const inquiries = [newInquiry];
      const content = JSON.stringify(inquiries, null, 2);
      await ossService.putBuffer('inquiries.json', Buffer.from(content));

      res.status(201).json({
        success: true,
        message: '询盘创建成功',
        data: newInquiry
      });
    } else {
      throw error;
    }
  }
}));

/**
 * PUT /api/inquiries/:id
 * 更新询盘
 */
router.put('/:id', asyncHandler(async (req, res) => {
  try {
    const result = await ossService.get('inquiries.json');
    const content = result.content.toString('utf-8');
    const inquiries = JSON.parse(content);

    const index = inquiries.findIndex(i => String(i.id) === String(req.params.id));

    if (index === -1) {
      throw new ApiError(404, `询盘 ID ${req.params.id} 不存在`, 'INQUIRY_NOT_FOUND');
    }

    // 更新询盘
    inquiries[index] = {
      ...inquiries[index],
      ...req.body,
      id: inquiries[index].id,
      updatedAt: new Date().toISOString()
    };

    // 保存到 OSS
    const newContent = JSON.stringify(inquiries, null, 2);
    await ossService.putBuffer('inquiries.json', Buffer.from(newContent));

    res.json({
      success: true,
      message: '询盘更新成功',
      data: inquiries[index]
    });
  } catch (error) {
    if (error.code === 'FILE_NOT_FOUND') {
      throw new ApiError(404, '询盘不存在', 'FILE_NOT_FOUND');
    }
    throw error;
  }
}));

/**
 * DELETE /api/inquiries/:id
 * 删除询盘
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  try {
    const result = await ossService.get('inquiries.json');
    const content = result.content.toString('utf-8');
    const inquiries = JSON.parse(content);

    const index = inquiries.findIndex(i => String(i.id) === String(req.params.id));

    if (index === -1) {
      throw new ApiError(404, `询盘 ID ${req.params.id} 不存在`, 'INQUIRY_NOT_FOUND');
    }

    const deletedInquiry = inquiries[index];
    inquiries.splice(index, 1);

    // 保存到 OSS
    const newContent = JSON.stringify(inquiries, null, 2);
    await ossService.putBuffer('inquiries.json', Buffer.from(newContent));

    // 审计日志
    logAudit('DELETE_INQUIRY', req.user, {
      inquiryId: req.params.id,
      name: deletedInquiry.name
    });

    res.json({
      success: true,
      message: '询盘删除成功',
      data: deletedInquiry
    });
  } catch (error) {
    if (error.code === 'FILE_NOT_FOUND') {
      throw new ApiError(404, '询盘不存在', 'FILE_NOT_FOUND');
    }
    throw error;
  }
}));

export default router;
