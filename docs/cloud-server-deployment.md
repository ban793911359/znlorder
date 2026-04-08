# 云服务器部署落地包

这份部署包针对当前项目的最小可上线架构：

- 1 台 Linux 云服务器
- 1 个 MySQL 8
- 1 个 Nginx
- 1 个 PM2 托管的 NestJS 后端
- 前端用 Vite 构建后由 Nginx 直接托管

推荐目录：

```text
/var/www/wechat-order-h5/
├─ backend/
├─ frontend/
└─ deploy/
```

## 1. 你需要亲自准备的内容

这些是我不能替你在线上环境自动完成、需要你亲自准备的：

### 服务器与账号

- 1 台 Linux 云服务器
- 可 SSH 登录的账号
- 服务器已开放 80 / 443 端口

### 域名与 DNS

- 前端域名，例如 `h5.example.com`
- 后端域名，例如 `api.example.com`
- DNS 解析到云服务器公网 IP

### HTTPS 证书

- Let's Encrypt
- 或云厂商托管证书

### 数据库

- MySQL 8 实例
- 数据库名、用户名、密码

### 生产环境密钥

- 一个足够长的 `JWT_SECRET`

### 如果你要做正式存储

- 腾讯云 COS / 阿里云 OSS / S3 其中之一
- bucket 名称
- 访问域名/CDN 域名
- AccessKey / SecretKey

### 如果服务器在中国大陆

- 域名备案

## 2. 我已经为你准备好的文件

### 生产环境变量模板

- 后端：[backend/.env.production.example](H:\360MoveData\Users\L\Documents\Playground\backend\.env.production.example)
- 前端：[frontend/.env.production.example](H:\360MoveData\Users\L\Documents\Playground\frontend\.env.production.example)

### Nginx 配置模板

- [deploy/nginx/wechat-order-h5.conf](H:\360MoveData\Users\L\Documents\Playground\deploy\nginx\wechat-order-h5.conf)

### PM2 配置

- [deploy/pm2/ecosystem.config.cjs](H:\360MoveData\Users\L\Documents\Playground\deploy\pm2\ecosystem.config.cjs)

### 部署脚本

- 后端：[deploy/scripts/deploy-backend.sh](H:\360MoveData\Users\L\Documents\Playground\deploy\scripts\deploy-backend.sh)
- 前端：[deploy/scripts/deploy-frontend.sh](H:\360MoveData\Users\L\Documents\Playground\deploy\scripts\deploy-frontend.sh)

## 3. 服务器初始化

推荐先安装这些组件：

```bash
sudo apt update
sudo apt install -y nginx mysql-client certbot python3-certbot-nginx
```

安装 Node.js 和 PM2：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 4. 上传项目

把项目上传到：

```text
/var/www/wechat-order-h5
```

确保结构类似：

```text
/var/www/wechat-order-h5/backend
/var/www/wechat-order-h5/frontend
/var/www/wechat-order-h5/deploy
```

## 5. 配置后端环境变量

复制后端模板：

```bash
cd /var/www/wechat-order-h5/backend
cp .env.production.example .env
```

重点修改：

- `APP_BASE_URL=https://api.example.com`
- `H5_BASE_URL=https://h5.example.com`
- `CORS_ORIGINS=https://h5.example.com`
- `DATABASE_URL=...`
- `JWT_SECRET=...`

如果你暂时仍用本地图片：

- `UPLOAD_STORAGE_DRIVER=local`
- `UPLOAD_PUBLIC_BASE_URL=https://api.example.com/uploads`

## 6. 配置前端环境变量

复制前端模板：

```bash
cd /var/www/wechat-order-h5/frontend
cp .env.production.example .env.production
```

重点修改：

- `VITE_API_BASE_URL=https://api.example.com`

## 7. 初始化数据库

先确保 MySQL 已创建库：

```sql
CREATE DATABASE wechat_order_h5 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

然后在后端目录执行：

```bash
cd /var/www/wechat-order-h5/backend
npm install
npm run prisma:generate
npm run prisma:deploy
```

测试环境如果要导入演示账号：

```bash
npm run prisma:seed
```

生产环境一般不要直接执行 `seed`。

## 8. 构建与启动后端

```bash
cd /var/www/wechat-order-h5/backend
npm install
npm run prisma:generate
npm run prisma:deploy
npm run build
pm2 start /var/www/wechat-order-h5/deploy/pm2/ecosystem.config.cjs
pm2 save
pm2 startup
```

健康检查地址：

```text
https://api.example.com/api/v1/health
```

## 9. 构建前端

```bash
cd /var/www/wechat-order-h5/frontend
npm install
npm run build
```

## 10. 配置 Nginx

把这份模板复制到服务器：

- [deploy/nginx/wechat-order-h5.conf](H:\360MoveData\Users\L\Documents\Playground\deploy\nginx\wechat-order-h5.conf)

示例：

```bash
sudo cp /var/www/wechat-order-h5/deploy/nginx/wechat-order-h5.conf /etc/nginx/sites-available/wechat-order-h5.conf
sudo ln -s /etc/nginx/sites-available/wechat-order-h5.conf /etc/nginx/sites-enabled/wechat-order-h5.conf
sudo nginx -t
sudo systemctl reload nginx
```

你需要把模板里的域名替换成你自己的：

- `h5.example.com`
- `api.example.com`

## 11. 配置 HTTPS

域名已经解析成功后，申请证书：

```bash
sudo certbot --nginx -d h5.example.com -d api.example.com
```

成功后再：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 12. 30 天图片清理

本项目已经内置图片清理命令：

```bash
cd /var/www/wechat-order-h5/backend
npm run uploads:cleanup
```

建议加 cron：

```bash
0 3 * * * cd /var/www/wechat-order-h5/backend && npm run uploads:cleanup >> /var/log/wechat-order-upload-cleanup.log 2>&1
```

## 13. 全流程测试顺序

部署后建议按这个顺序测试：

1. 打开前端登录页
2. 运营端登录
3. 新建订单
4. 复制客户链接
5. 客户端打开客户链接
6. 仓库端登录
7. 查看待发货订单
8. 填写快递公司和运单号
9. 客户端刷新查看物流

## 14. 如果你第一步先上 Railway

当前项目也已经补了 Railway 相关准备：

- 后端：[backend/railway.toml](H:\360MoveData\Users\L\Documents\Playground\backend\railway.toml)
- 前端：[frontend/server.mjs](H:\360MoveData\Users\L\Documents\Playground\frontend\server.mjs)

Railway 你仍然需要亲自准备：

- Railway 项目
- Railway MySQL 服务或外部 MySQL
- Railway 前端公开域名
- Railway 后端公开域名
- 把前端域名填到后端 `H5_BASE_URL`
- 把后端域名填到前端 `VITE_API_BASE_URL`

## 15. 当前我的建议

如果你现在目标是“尽快做第一轮外网全流程测试”，建议优先级是：

1. 先上 Railway 测一轮外网链路
2. 再落正式云服务器
3. 然后把图片存储切到 COS / OSS

这样你能更快验证：

- 微信外网访问
- HTTPS
- 分享链接
- 客户端单链接查看
