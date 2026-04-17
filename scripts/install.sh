#!/bin/bash

# Carval Auto Backend - 快速安装脚本
# 用于初始化项目和安装依赖

set -e

echo "=========================================="
echo "  Carval Auto Backend 安装向导"
echo "=========================================="
echo ""

# 检查 Node.js 版本
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    echo "请先安装 Node.js 18+: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 版本过低"
    echo "当前版本: $(node -v)"
    echo "需要版本: 18.0.0 或更高"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"
echo ""

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装"
    exit 1
fi

echo "✅ npm 版本: $(npm -v)"
echo ""

# 创建 .env 文件
if [ ! -f .env ]; then
    echo "📝 创建 .env 文件..."
    cp .env.example .env
    echo "✅ .env 文件已创建"
    echo ""
    echo "⚠️  请编辑 .env 文件填入以下配置:"
    echo "   - GH_TOKEN (GitHub Personal Access Token)"
    echo "   - GH_REPO (仓库地址)"
else
    echo "✅ .env 文件已存在"
fi
echo ""

# 安装依赖
echo "📦 安装依赖..."
npm install

echo ""
echo "=========================================="
echo "  ✅ 安装完成!"
echo "=========================================="
echo ""
echo "下一步:"
echo "1. 编辑 .env 文件填入配置"
echo "2. 运行 'npm run dev' 启动开发服务器"
echo "3. 访问 http://localhost:3000/api/health 检查服务"
echo ""
