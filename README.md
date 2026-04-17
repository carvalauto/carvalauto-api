# Carval Auto Backend

安全的汽车配件产品管理后端 API 系统。

## 功能特性

- 🔒 **安全认证**: GitHub Token 验证，保护敏感操作
- 🛡️ **速率限制**: 防止滥用和 DDoS 攻击
- 🌐 **CORS 保护**: 只允许指定域名访问
- 📝 **完整日志**: 记录所有操作，便于审计
- 🔄 **数据同步**: GitHub 与 OSS 数据同步
- 📊 **产品管理**: CRUD + 批量操作
- 🔍 **数据验证**: 自动检测和修复数据问题

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境

```bash
cp .env.example .env
# 编辑 .env 填入配置
```

### 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 运行测试

```bash
npm test
```

## 项目结构

```
carvalauto-backend/
├── src/
│   ├── server.js          # 主服务器入口
│   ├── routes/            # API 路由
│   │   ├── health.js      # 健康检查
│   │   ├── products.js     # 产品管理
│   │   └── sync.js         # 数据同步
│   ├── middleware/         # 中间件
│   │   ├── auth.js         # 认证
│   │   ├── cors.js         # CORS 配置
│   │   ├── errorHandler.js # 错误处理
│   │   └── logger.js       # 日志
│   └── services/           # 业务逻辑
│       ├── github.js       # GitHub API
│       ├── logger.js       # 日志服务
│       ├── oss.js          # 阿里云 OSS
│       └── product.js      # 产品服务
├── api-client.js           # 前端 API 客户端
├── .env.example             # 环境变量示例
├── vercel.json             # Vercel 配置
├── API.md                  # API 文档
├── DEPLOY.md               # 部署指南
└── README.md               # 本文件
```

## API 接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | /api/health | 健康检查 | ❌ |
| GET | /api/products | 获取产品列表 | ❌ |
| GET | /api/products/:id | 获取单个产品 | ❌ |
| POST | /api/products | 创建产品 | ✅ |
| PUT | /api/products/:id | 更新产品 | ✅ |
| DELETE | /api/products/:id | 删除产品 | ✅ |
| POST | /api/products/batch-delete | 批量删除 | ✅ |
| POST | /api/products/batch-create | 批量创建 | ✅ |
| POST | /api/sync | 同步数据 | ✅ |

## 部署方式

- **方案 A: Vercel** (推荐) - 免费、自动 HTTPS
- **方案 B: Railway** - 简单、持久化
- **方案 C: VPS** - 完全控制

详细部署说明请参考 [DEPLOY.md](DEPLOY.md)

## 技术栈

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **认证**: GitHub Token
- **存储**: GitHub + 阿里云 OSS
- **日志**: Winston
- **部署**: Vercel / Railway / PM2

## 许可证

MIT License
