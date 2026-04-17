# Carval Auto API 文档

## 概述

Carval Auto 后端 API 提供安全的产品管理接口，所有 OSS 操作通过后端完成，前端无需暴露密钥。

**基础 URL**: `https://your-api-domain.com`

---

## 认证

### GitHub Token 认证

所有需要认证的接口，请在请求头中添加：

```
Authorization: token YOUR_GITHUB_TOKEN
```

### 获取 GitHub Token

1. 访问 [GitHub Settings](https://github.com/settings/tokens)
2. 点击 "Generate new token (classic)"
3. 选择权限：`repo` (Full control of private repositories)
4. 生成并保存 Token

---

## 健康检查

### 基础检查

```
GET /api/health
```

**响应**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "service": "carvalauto-backend",
  "version": "1.0.0"
}
```

### 详细检查

```
GET /api/health/detailed
```

检查 GitHub 和 OSS 连接状态。

---

## 产品管理

### 获取产品列表

```
GET /api/products
```

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| search | string | - | 搜索关键词（名称、OEM） |
| category | string | all | 分类筛选 |
| page | number | 1 | 页码 |
| limit | number | 20 | 每页数量（最大100） |
| sortBy | string | id | 排序字段 |
| sortOrder | string | asc | 排序方向 |

**示例**:
```bash
curl "https://api.example.com/api/products?category=oil&page=1&limit=20"
```

**响应**:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 100,
    "totalPages": 5,
    "currentPage": 1,
    "limit": 20,
    "hasNext": true,
    "hasPrev": false
  },
  "categoryStats": {
    "all": 100,
    "japanese": 20,
    "oil": 30,
    "other": 50
  }
}
```

---

### 获取单个产品

```
GET /api/products/:id
```

**示例**:
```bash
curl "https://api.example.com/api/products/1"
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Product Name",
    "category": "oil",
    "oem": "10W-30",
    "images": ["url1", "url2"],
    ...
  }
}
```

---

### 创建产品

```
POST /api/products
```

**请求头**:
```
Authorization: token YOUR_GITHUB_TOKEN
Content-Type: application/json
```

**请求体**:
```json
{
  "name": "Product Name",
  "title": "Product Title",
  "category": "oil",
  "oem": "10W-30",
  "url": "https://...",
  "description": "Product description",
  "images": ["url1", "url2"],
  "fitmentTable": []
}
```

**响应**:
```json
{
  "success": true,
  "message": "产品创建成功",
  "data": { ... },
  "totalProducts": 101
}
```

---

### 更新产品

```
PUT /api/products/:id
```

**请求体**:
```json
{
  "name": "Updated Name",
  "category": "japanese"
}
```

**注意**: 无法通过 body 修改产品 ID。

---

### 删除产品

```
DELETE /api/products/:id?confirm=true
```

**重要**: 删除操作需要二次确认，添加 `?confirm=true` 参数。

**响应**:
```json
{
  "success": true,
  "message": "产品删除成功",
  "deleted": { ... },
  "totalProducts": 99
}
```

---

### 批量删除

```
POST /api/products/batch-delete?confirm=true
```

**请求体**:
```json
{
  "ids": [1, 2, 3, 4, 5]
}
```

**限制**: 单次最多删除 50 个产品。

---

### 批量创建

```
POST /api/products/batch-create
```

**请求体**:
```json
{
  "products": [
    { "name": "Product 1", "category": "oil" },
    { "name": "Product 2", "category": "japanese" }
  ]
}
```

**限制**: 单次最多创建 100 个产品。

---

### 获取产品统计

```
GET /api/products/stats/summary
```

**响应**:
```json
{
  "success": true,
  "data": {
    "totalProducts": 100,
    "categoryStats": { ... },
    "topOems": [
      { "oem": "10W-30", "count": 15 }
    ],
    "lastUpdated": "2024-01-01T00:00:00.000Z",
    "hasImages": 95,
    "withoutImages": 5
  }
}
```

---

## 同步 API

### 同步数据

```
POST /api/sync
Authorization: token YOUR_GITHUB_TOKEN
```

触发从 GitHub 到 OSS 的数据同步。

**响应**:
```json
{
  "success": true,
  "message": "同步成功",
  "data": {
    "totalProducts": 100,
    "version": "24.01.01.1200",
    "updatedAt": "2024-01-01T12:00:00.000Z",
    "duration": "150ms"
  }
}
```

---

### 验证数据

```
POST /api/sync/verify
Authorization: token YOUR_GITHUB_TOKEN
```

检查数据完整性和常见问题。

**响应**:
```json
{
  "success": true,
  "data": {
    "total": 100,
    "valid": 95,
    "invalid": 5,
    "healthPercentage": "95.0",
    "issues": [
      { "id": 1, "name": "Product", "issues": ["缺少图片"] }
    ]
  }
}
```

---

### 修复数据

```
POST /api/sync/fix
Authorization: token YOUR_GITHUB_TOKEN
```

自动修复常见数据问题（字段一致性等）。

---

## 错误响应

所有错误响应遵循统一格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": { ... }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 常见错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| MISSING_GITHUB_TOKEN | 401 | 缺少 GitHub Token |
| INVALID_TOKEN | 401 | 无效的 Token |
| PRODUCT_NOT_FOUND | 404 | 产品不存在 |
| VALIDATION_ERROR | 400 | 请求参数错误 |
| CONFIRMATION_REQUIRED | 400 | 需要二次确认 |
| RATE_LIMIT_EXCEEDED | 429 | 请求过于频繁 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |

---

## 速率限制

- 通用限制：15 分钟内最多 100 个请求
- 写操作限制：1 分钟内最多 10 个请求

响应头中包含：
- `X-RateLimit-Remaining`: 剩余请求数
- `X-RateLimit-Reset`: 重置时间戳

---

## 产品数据结构

```typescript
interface Product {
  id: number;              // 产品 ID
  name: string;           // 产品名称
  title: string;           // 产品标题
  category: string;        // 分类 (japanese|korean|german|chinese|american|oil|other)
  oem: string;             // OEM 编码
  oemCode: string;         // OEM 编码（别名）
  url: string;             // 原链接
  description: string;     // 描述
  image: string;           // 主图 URL（逗号分隔）
  images: string[];        // 图片数组
  fitmentTable: object[]; // 适用表格
  createdAt: string;       // 创建时间
  updatedAt: string;       // 更新时间
}
```

---

## 使用示例

### JavaScript (ES6)

```javascript
import api from './api-client.js';

// 配置 API 地址
api.baseURL = 'https://your-api.vercel.app';

// 设置 Token
api.setGitHubToken('ghp_xxxxx');

// 获取产品
const result = await api.getProducts({ category: 'oil', page: 1 });
console.log(result.data);

// 创建产品
const newProduct = await api.createProduct({
  name: 'Test Product',
  category: 'oil',
  oem: 'TEST-001'
});

// 更新产品
await api.updateProduct(123, { name: 'Updated Name' });

// 删除产品
await api.deleteProduct(123, true);
```

---

## 更新日志

### v1.0.0 (2024-01-01)
- 初始版本
- 支持产品 CRUD 操作
- 支持批量操作
- 支持数据同步
- 支持数据验证和修复
