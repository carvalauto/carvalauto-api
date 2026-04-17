# Carval Auto 后端部署指南

## 目录

- [方案 A: Vercel (推荐)](#方案-a-vercel-推荐)
- [方案 B: Railway](#方案-b-railway)
- [方案 C: 自己的 VPS](#方案-c-自己的-vps)
- [部署后配置](#部署后配置)
- [常见问题](#常见问题)

---

## 方案 A: Vercel (推荐)

**优点**: 免费、易部署、自动 HTTPS、内置 CDN

### 准备工作

1. 注册 Vercel 账号: https://vercel.com
2. 安装 Vercel CLI:
   ```bash
   npm i -g vercel
   ```

### 部署步骤

1. **进入后端目录**
   ```bash
   cd carvalauto-backend
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **创建 .env 文件**
   ```bash
   cp .env.example .env
   ```

4. **编辑 .env 文件**，填入实际配置：
   ```env
   NODE_ENV=production
   PORT=3000
   GH_REPO=carvalauto/carvalauto.github.io
   GH_TOKEN=ghp_your_token_here
   GH_BRANCH=main
   ALLOWED_ORIGINS=https://carvalautopart.com,https://www.carvalautopart.com
   ```

5. **部署到预览环境**
   ```bash
   vercel
   ```

6. **部署到生产环境**
   ```bash
   vercel --prod
   ```

### 配置环境变量

**通过 Vercel Dashboard**:
1. 进入项目 Settings
2. 点击 Environment Variables
3. 添加所有 .env 中的变量

**通过 CLI**:
```bash
vercel env add GH_TOKEN
vercel env add GH_REPO
# ... 其他变量
```

### 绑定自定义域名

1. 进入项目 Settings → Domains
2. 添加你的域名 (如 `api.carvalautopart.com`)
3. 配置 DNS 记录
4. Vercel 自动配置 SSL

---

## 方案 B: Railway

**优点**: 简单、支持持久化、支持自动部署

### 部署步骤

1. **注册 Railway**
   访问 https://railway.app

2. **创建项目**
   - 点击 "New Project"
   - 选择 "Deploy from GitHub repo"
   - 连接你的 GitHub 仓库

3. **配置环境变量**
   - 进入项目 Settings → Variables
   - 添加所有必需的环境变量

4. **设置启动命令**
   ```
   npm start
   ```

5. **部署**
   Railway 会自动检测并部署

### Railway CLI 部署

```bash
# 安装 Railway CLI
npm i -g @railway/cli

# 登录
railway login

# 初始化
railway init

# 设置环境变量
railway variables set GH_TOKEN=ghp_xxx
railway variables set GH_REPO=carvalauto/carvalauto.github.io

# 部署
railway up
```

---

## 方案 C: 自己的 VPS

**优点**: 完全控制、无平台限制

### 服务器要求

- Ubuntu 20.04+ / Debian 11+
- 1GB+ RAM
- Node.js 18+

### 部署步骤

1. **SSH 连接到服务器**
   ```bash
   ssh root@your-server-ip
   ```

2. **安装 Node.js**
   ```bash
   # 安装 Node.js 18.x
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # 验证安装
   node --version
   npm --version
   ```

3. **安装 PM2 (进程管理器)**
   ```bash
   npm install -g pm2
   ```

4. **创建应用目录**
   ```bash
   mkdir -p /var/www/carvalapi
   cd /var/www/carvalapi
   ```

5. **上传代码**
   ```bash
   # 通过 scp 上传
   scp -r ./carvalauto-backend/* root@your-server-ip:/var/www/carvalapi/
   
   # 或者使用 git clone
   cd /var/www/carvalapi
   git clone https://github.com/carvalauto/carvalauto-backend.git .
   ```

6. **安装依赖**
   ```bash
   npm install
   ```

7. **创建 .env 文件**
   ```bash
   nano .env
   ```
   
   填入配置内容。

8. **使用 PM2 启动**
   ```bash
   pm2 start src/server.js --name carvalapi
   
   # 设置开机自启
   pm2 save
   pm2 startup
   ```

9. **配置 Nginx 反向代理**
   ```bash
   apt install nginx
   
   nano /etc/nginx/sites-available/carvalapi
   ```

   配置文件内容：
   ```nginx
   server {
       listen 80;
       server_name api.carvalautopart.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   启用站点：
   ```bash
   ln -s /etc/nginx/sites-available/carvalapi /etc/nginx/sites-enabled/
   nginx -t
   systemctl restart nginx
   ```

10. **配置 SSL (Let's Encrypt)**
    ```bash
    apt install certbot python3-certbot-nginx
    certbot --nginx -d api.carvalautopart.com
    ```

11. **防火墙配置**
    ```bash
    ufw allow 22
    ufw allow 80
    ufw allow 443
    ufw enable
    ```

### 更新部署

```bash
cd /var/www/carvalapi
git pull
npm install
pm2 restart carvalapi
pm2 logs carvalapi --nostream
```

---

## 部署后配置

### 1. 更新前端 API 地址

在 admin.html 中修改 API 调用地址：

```javascript
// 原来的方式（已废弃，不安全）
// 直接使用 GitHub Token

// 新的方式（推荐）
const API_BASE = 'https://your-api-domain.com';

// 使用 api-client.js
import api from './api-client.js';
api.baseURL = 'https://your-api-domain.com';
api.setGitHubToken('ghp_xxxxx');

// 调用 API
const result = await api.getProducts({ category: 'oil' });
```

### 2. 验证部署

```bash
# 健康检查
curl https://your-api-domain.com/api/health

# 详细检查
curl https://your-api-domain.com/api/health/detailed

# 获取产品
curl https://your-api-domain.com/api/products
```

### 3. 监控设置

- 查看日志: `pm2 logs carvalapi`
- 监控状态: `pm2 monit`
- 重启服务: `pm2 restart carvalapi`

---

## 常见问题

### Q: 部署后 API 返回 401 错误？

检查：
1. `.env` 文件中的 `GH_TOKEN` 是否正确
2. Token 是否有 `repo` 权限
3. Token 是否过期

### Q: 速率限制错误 (429)？

这是正常的保护机制。如需更高限制，可以调整 `.env` 中的：
```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200
```

### Q: 如何扩展服务器资源？

**Vercel**: 无需手动扩展，平台自动处理

**Railway**: 在 Railway Dashboard 调整 Plan

**VPS**: 升级服务器配置或使用负载均衡

### Q: 如何备份数据？

数据存储在 GitHub，使用 GitHub 备份：
```bash
# 克隆仓库
git clone https://github.com/carvalauto/carvalauto.github.io.git backup
```

### Q: 如何处理大文件上传？

当前 API 限制请求体 10MB。如需上传更大文件：
1. 使用 OSS 直传（后端生成签名 URL）
2. 分片上传

---

## 安全建议

1. **定期轮换 Token**: 建议每 3 个月更换一次 GitHub Token
2. **限制 IP 访问**: 在 Nginx 中配置 IP 白名单
3. **启用日志监控**: 设置异常登录告警
4. **定期更新依赖**: `npm audit fix`
5. **使用 Web Application Firewall**: 如 Cloudflare

---

## 技术支持

如有问题，请：
1. 查看日志: `pm2 logs`
2. 检查环境变量配置
3. 提交 GitHub Issue
