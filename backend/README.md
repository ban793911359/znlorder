# 微信成交后订单录单 H5 后端

这是一个基于 `NestJS + Prisma + MySQL` 的后端服务，覆盖以下 MVP 能力：

- 运营端 / 仓库端登录鉴权
- 角色权限控制
- 新建订单、编辑订单、订单列表、订单详情
- 按手机号识别老客户并回填最近收货资料
- 图片上传
- 今日订单统计
- 仓库待发货列表、确认发货
- 客户端通过 `订单号 + token` 查看单笔订单详情

## 目录

```text
backend/
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts
├─ src/
│  ├─ common/
│  ├─ database/
│  └─ modules/
│     ├─ auth/
│     ├─ customers/
│     ├─ orders/
│     ├─ uploads/
│     └─ stats/
├─ uploads/
├─ .env.example
├─ package.json
└─ README.md
```

## 1. 安装依赖

```bash
cd backend
npm install
```

## 2. 配置环境变量

复制环境变量示例：

```bash
cp .env.example .env
```

Windows PowerShell 可以用：

```powershell
Copy-Item .env.example .env
```

重点配置：

- `DATABASE_URL`
- `JWT_SECRET`
- `APP_BASE_URL`
- `H5_BASE_URL`
- `UPLOAD_STORAGE_DRIVER`
- `UPLOAD_PUBLIC_BASE_URL`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_BUCKET_PREFIX`
- `UPLOAD_RETENTION_DAYS`

说明：

- `APP_BASE_URL` 建议填后端服务地址，例如 `https://api.example.com`
- `H5_BASE_URL` 建议填前端 H5 域名，例如 `https://h5.example.com`
- 本地开发时可以填 `http://localhost:5173`
- `UPLOAD_RETENTION_DAYS` 默认 `30`，表示商品图片只保留 30 天
- 订单主数据长期保留，图片文件到期后可删除，删除后不影响订单详情主数据查看
- `UPLOAD_STORAGE_DRIVER` 默认 `local`
- `UPLOAD_PUBLIC_BASE_URL` 在正式上线切 COS / OSS / CDN 时可填写，如 `https://cdn.example.com/order-images`
- 如果切 `Cloudflare R2`，把 `UPLOAD_STORAGE_DRIVER` 设为 `r2`
- `UPLOAD_PUBLIC_BASE_URL` 需要填你的 R2 公网访问域名或自定义域名，例如 `https://cdn.example.com`
- `R2_BUCKET_PREFIX` 默认 `order-images`，最终对象 key 会形如 `order-images/images/xxx.webp`

## 3. 初始化数据库

先在 MySQL 中创建数据库，例如：

```sql
CREATE DATABASE wechat_order_h5 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

然后执行：

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## 4. 启动开发环境

```bash
npm run start:dev
```

默认启动地址：

```text
http://localhost:3000
```

静态上传文件访问前缀：

```text
http://localhost:3000/uploads/...
```

## 5. 默认测试账号

`prisma/seed.ts` 会创建两个默认账号：

- 运营端
  - 用户名：`operator`
  - 密码：`Operator@123`
- 仓库端
  - 用户名：`warehouse`
  - 密码：`Warehouse@123`

## 6. 主要接口

### 鉴权

- `POST /api/v1/auth/login`

### 客户

- `GET /api/v1/customers/identify?mobile=13800000000`

### 上传

- `POST /api/v1/uploads/images`

### 运营端订单

- `POST /api/v1/orders`
- `GET /api/v1/orders`
- `GET /api/v1/orders/:id`
- `PATCH /api/v1/orders/:id`

### 仓库端

- `GET /api/v1/warehouse/orders/pending`
- `POST /api/v1/warehouse/orders/:id/ship`

### 客户端公开订单

- `GET /api/v1/public/orders/:orderNo?token=xxxxx`

### 统计

- `GET /api/v1/stats/today-orders`

## 7. 订单号与 token 逻辑

### 订单号

订单号格式：

```text
ZN + YYYYMMDD + 当日流水号
```

示例：

```text
ZN20260330001
ZN20260330002
```

实现方式：

- 使用 `order_sequences` 表保存当天流水
- 在事务内先锁定当天序列表记录，再递增
- 保证并发下订单号不重复

### 客户端 token

实现方式：

- 创建订单时生成随机 token
- 数据库只保存 `sha256` 后的 token hash
- 返回给运营端的是原始 token 和可分享链接
- 客户访问详情时必须同时提供 `orderNo + token`

这样做的好处：

- 即使数据库泄露，也不会直接暴露前台访问 token
- 客户端默认只能访问当前这一笔订单

## 8. 状态说明

系统已内置以下订单状态：

- `draft`
- `pending_shipment`
- `shipped`
- `completed`
- `cancelled`

当前 MVP 实际主流程：

- 新建订单后默认进入 `pending_shipment`
- 仓库确认发货后更新为 `shipped`

## 9. 说明

- “今日订单后台表”当前没有单独建表，而是直接基于 `orders.created_at` 聚合统计，MVP 更轻量
- 客户端公开查询接口不会返回历史订单、内部备注、仓库备注
- 上传文件当前使用本地磁盘存储，后续可以平滑切 OSS / COS / MinIO

## 10. 订单图片 30 天保留策略

当前项目已经把“订单数据”和“图片文件”做了分离设计：

- `orders` / `order_items` / `customers` 等业务数据长期保留
- `upload_files` 只保存图片元数据和生命周期信息
- 商品图片文件默认保留 `30` 天
- 图片到期删除后，订单详情仍然可以正常查看文字、金额、地址、物流等主数据

`upload_files` 关键字段：

- `storage_driver`
- `storage_key`
- `file_url`
- `expires_at`
- `deleted_at`

语义说明：

- `expires_at`：图片逻辑过期时间，默认创建后 30 天
- `deleted_at`：图片实际删除时间
- `storage_key`：对象存储或本地文件的相对 key，方便做生命周期清理

### 本地存储模式

本地开发或低成本环境下，图片仍落盘到：

```text
backend/uploads/images/
```

清理命令：

```bash
npm run uploads:cleanup
```

建议在服务器上配一个每天凌晨执行的定时任务，例如：

```bash
0 3 * * * cd /path/to/backend && npm run uploads:cleanup >> /var/log/wechat-order-upload-cleanup.log 2>&1
```

### 对象存储模式

正式上线建议切到 COS / OSS / S3 类对象存储，并把商品图片放在单独前缀下，例如：

```text
order-images/images/xxxx.jpg
```

推荐做法：

1. 应用层继续写入 `upload_files` 元数据，保留 `storage_key`、`expires_at`
2. 真实文件上传到对象存储 bucket
3. bucket 生命周期规则设置为 30 天自动删除
4. 订单详情接口通过 `expires_at` / `deleted_at` 返回 `available=false`
5. 前端在图片不可用时展示“图片已过期”，不展示裂图

### Cloudflare R2 接入

当前项目已经内置了 `local / r2` 双模式：

```env
UPLOAD_STORAGE_DRIVER=r2
UPLOAD_PUBLIC_BASE_URL=https://your-public-r2-domain.example.com
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET=your-r2-bucket-name
R2_BUCKET_PREFIX=order-images
UPLOAD_RETENTION_DAYS=30
```

接入说明：

1. 在 Cloudflare R2 创建 bucket
2. 生成 S3 API Token
3. 给 bucket 开通公网访问，或绑定自定义域名
4. 把该公网域名填到 `UPLOAD_PUBLIC_BASE_URL`
5. 在 Cloudflare R2 生命周期规则里把 `order-images/` 前缀设置为 30 天后自动删除

当前实现细节：

- 上传接口保持不变，仍是 `POST /api/v1/uploads/images`
- 后端会按 `UPLOAD_STORAGE_DRIVER` 自动切换到本地磁盘或 R2
- `upload_files` 表继续保留元数据，订单主数据不受影响
- `npm run uploads:cleanup` 现在既能删本地文件，也能删 R2 对象

### 前端过期展示

当图片过期或已删除时：

- 订单主数据照常显示
- 商品图片区域显示“图片已过期”
- 不影响仓库回查、客户查看订单状态和物流信息
