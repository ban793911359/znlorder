# Railway 部署清单

这份文档针对当前项目的第一阶段目标：

- 先把前端和后端都部署到 Railway
- 先跑通外网访问、HTTPS、分享链接、微信打开
- 先做全流程测试
- 暂时不追求最终生产级架构

## 1. 你要在 Railway 上创建的服务

建议拆成 3 个服务：

1. `wechat-order-h5-backend`
2. `wechat-order-h5-frontend`
3. `mysql`

推荐同一个 Railway Project 下创建这 3 个服务。

## 2. 我已经为你准备好的文件

- 后端 Railway 配置  
  [backend/railway.toml](H:\360MoveData\Users\L\Documents\Playground\backend\railway.toml)
- 前端 Railway 配置  
  [frontend/railway.toml](H:\360MoveData\Users\L\Documents\Playground\frontend\railway.toml)
- 前端静态服务入口  
  [frontend/server.mjs](H:\360MoveData\Users\L\Documents\Playground\frontend\server.mjs)

## 3. 你需要亲自准备的内容

这些需要你在 Railway 控制台里亲自完成：

### Railway 项目与仓库绑定

- 新建一个 Railway Project
- 连接你的 Git 仓库

### 服务 Root Directory

你需要分别设置两个代码服务的根目录：

- 后端服务 Root Directory：`backend`
- 前端服务 Root Directory：`frontend`

### Railway 数据库

你需要在 Railway 里添加一个 MySQL 服务，或者使用你自己的外部 MySQL。

### 公网域名

你需要为两个服务生成 Railway 域名，或者绑定自定义域名：

- 前端域名，例如：`https://xxx.up.railway.app`
- 后端域名，例如：`https://yyy.up.railway.app`

### 环境变量

你需要把正确的域名回填到前后端环境变量里。

## 4. 后端服务配置

服务目录：

```text
backend
```

Railway 会读取：

- [backend/railway.toml](H:\360MoveData\Users\L\Documents\Playground\backend\railway.toml)

### 后端必须设置的环境变量

- `HOST=0.0.0.0`
- `PORT=${{PORT}}`
- `APP_BASE_URL=https://你的后端域名`
- `H5_BASE_URL=https://你的前端域名`
- `CORS_ORIGINS=https://你的前端域名`
- `APP_TIMEZONE=Asia/Shanghai`
- `JWT_SECRET=你自己生成的长随机串`
- `JWT_EXPIRES_IN=7d`
- `DATABASE_URL=Railway MySQL 连接串`
- `UPLOAD_DIR=uploads`
- `UPLOAD_STORAGE_DRIVER=local`
- `UPLOAD_PUBLIC_BASE_URL=https://你的后端域名/uploads`
- `UPLOAD_RETENTION_DAYS=30`
- `MAX_UPLOAD_SIZE_MB=5`

### 注意

Railway 的本地磁盘不是长期稳定对象存储。

所以：

- 如果你只是做第一轮全流程测试，可以暂时用 `local`
- 如果你要持续保存图片，应该尽快改成 COS / OSS / S3

## 5. 前端服务配置

服务目录：

```text
frontend
```

Railway 会读取：

- [frontend/railway.toml](H:\360MoveData\Users\L\Documents\Playground\frontend\railway.toml)

### 前端必须设置的环境变量

- `VITE_API_BASE_URL=https://你的后端域名`

### 前端运行方式

当前我已经改成：

- 构建：`npm run build`
- 启动：`npm run start`

它会通过 [frontend/server.mjs](H:\360MoveData\Users\L\Documents\Playground\frontend\server.mjs) 提供静态页面和 SPA 路由回退。

## 6. Railway MySQL 怎么接

如果你直接使用 Railway 自带 MySQL：

1. 在同一个 Project 里添加 MySQL 服务
2. 在后端服务 Variables 里引用它的连接串
3. 填到 `DATABASE_URL`

部署后后端会自动执行：

- `npm run prisma:deploy`

所以数据库 schema 会自动迁移到最新版本。

## 7. 首次上线顺序

建议按这个顺序操作：

1. 创建 Railway Project
2. 添加 MySQL 服务
3. 创建后端服务，Root Directory 选 `backend`
4. 配好后端环境变量
5. 创建前端服务，Root Directory 选 `frontend`
6. 配好前端环境变量
7. 先部署后端
8. 拿到后端域名后，填进前端 `VITE_API_BASE_URL`
9. 再部署前端
10. 拿到前端域名后，回填后端 `H5_BASE_URL` 和 `CORS_ORIGINS`
11. 重新部署后端

## 8. 首次部署后怎么验证

先验证后端：

- `https://你的后端域名/api/v1/health`

预期：

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

再验证前端：

- 打开前端登录页
- 用默认测试账号登录

然后验证主流程：

1. 运营端登录
2. 新建订单
3. 自动复制客户链接
4. 打开客户链接
5. 仓库端登录
6. 查询待发货
7. 填快递公司和运单号
8. 客户端刷新查看物流

## 9. Railway 第一阶段最容易踩的坑

### 坑 1：分享链接配成后端域名

你必须确保：

- `H5_BASE_URL = 前端域名`

不是后端域名。

### 坑 2：前端没指向正确 API

你必须确保：

- `VITE_API_BASE_URL = 后端域名`

### 坑 3：CORS 没包含前端域名

你必须确保：

- `CORS_ORIGINS` 包含前端 Railway 域名

### 坑 4：本地图片在 Railway 上不适合长期保留

Railway 更适合应用运行，不适合把本地文件系统当长期素材库。

所以这阶段要清楚：

- 订单数据可持续测试
- 图片用于阶段性验证可以
- 长期正式使用建议改对象存储

### 坑 5：部署顺序反了

如果你先部署前端，但还没拿到后端域名，前端接口地址会配不对。

所以先后顺序很重要：

- 先后端
- 再前端
- 最后回填分享链接域名

## 10. Railway 第一阶段是否适合当前项目

我的判断：

- 适合做第一阶段外网全流程测试：是
- 适合直接长期正式跑本地图片版：不建议

最佳用法：

- Railway 跑第一轮外网联调
- 验证微信访问、HTTPS、分享链接、发货链路
- 之后再迁移到正式云服务器或接入对象存储
