# 微信成交后订单录单 H5

## 1. 项目简介

这是一个面向微信成交后人工录单场景的移动端 H5 系统。

它不是商城，也不是支付系统，而是帮助运营人员在微信沟通成交后，快速完成以下流程：

- 手工录入订单
- 上传本次成交商品图片
- 识别老客户并带出历史收货资料
- 生成订单号与客户专属访问链接
- 将订单流转给仓库发货
- 让客户通过单笔链接查看本次订单详情

当前版本定位为最小可用版本，优先跑通：

- 运营录单
- 仓库发货
- 客户查看单笔订单

## 2. 技术栈

### 前端

- Vue 3
- TypeScript
- Vite
- Vant
- Pinia
- Vue Router
- Axios

### 后端

- Node.js
- NestJS
- Prisma
- MySQL 8
- JWT 鉴权
- Multer 本地文件上传

### 选择原则

这套技术栈优先考虑：

- 最容易本地跑通
- 最适合微信内置浏览器里的移动端 H5
- 最方便后续部署到 HTTPS 域名
- 前后端结构清晰，方便继续扩展运营端、仓库端、客户端

## 3. 项目目录说明

```text
project-root/
├─ backend/                  # NestJS 后端
│  ├─ prisma/                # Prisma schema、migration、seed
│  ├─ src/common/            # 公共工具、守卫、中间件、异常处理
│  ├─ src/database/          # PrismaService
│  ├─ src/modules/auth/      # 登录鉴权
│  ├─ src/modules/customers/ # 老客户识别
│  ├─ src/modules/orders/    # 订单、仓库发货、客户端订单查询
│  ├─ src/modules/uploads/   # 图片上传
│  ├─ src/modules/stats/     # 今日订单统计
│  └─ uploads/               # 本地上传目录
├─ frontend/                 # Vue 3 H5 前端
│  ├─ src/api/               # 接口封装
│  ├─ src/components/        # 公共组件
│  ├─ src/layouts/           # 布局
│  ├─ src/router/            # 路由
│  ├─ src/stores/            # Pinia 状态
│  ├─ src/styles/            # 全局样式
│  ├─ src/utils/             # 格式化、草稿、本地缓存
│  └─ src/views/             # 登录页、运营端、仓库端、客户端页面
├─ docs/                     # 联调清单与部署建议
└─ README.md                 # 项目总说明
```

## 4. 本地开发步骤

### 4.1 准备环境

建议版本：

- Node.js 18 或 20
- MySQL 8
- npm 9+

### 4.2 克隆并进入项目

```bash
git clone <your-repo-url>
cd <your-repo-name>
```

### 4.3 初始化数据库

先在 MySQL 中创建数据库：

```sql
CREATE DATABASE wechat_order_h5 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

然后执行后端 Prisma 初始化：

```bash
cd backend
npm install
Copy-Item .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### 4.4 启动后端

```bash
cd backend
npm run start:dev
```

### 4.5 启动前端

```bash
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

### 4.6 打开浏览器

- 前端开发地址：`http://localhost:5173`
- 后端开发地址：`http://localhost:3000`

## 5. 后端启动方法

后端目录：[backend](./backend)

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

常用命令：

- `npm run start:dev`：开发模式
- `npm run build`：构建
- `npm run start:prod`：生产启动

## 6. 前端启动方法

前端目录：[frontend](./frontend)

```bash
cd frontend
npm install
npm run dev
```

常用命令：

- `npm run dev`：本地开发
- `npm run build`：构建生产包
- `npm run preview`：本地预览打包结果

## 7. 数据库初始化方法

### 第一步：创建数据库

```sql
CREATE DATABASE wechat_order_h5 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 第二步：执行 migration

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

### 第三步：导入测试数据

```bash
npm run prisma:seed
```

当前 seed 会初始化：

- 运营端账号 1 个
- 仓库端账号 1 个
- 测试客户 3 个
- 示例订单 4 笔

## 8. 环境变量说明

### 后端环境变量

文件示例：[backend/.env.example](./backend/.env.example)

```env
PORT=3000
APP_BASE_URL=http://localhost:3000
APP_TIMEZONE=Asia/Shanghai
JWT_SECRET=replace-with-a-very-long-random-string
JWT_EXPIRES_IN=7d
DATABASE_URL="mysql://root:password@127.0.0.1:3306/wechat_order_h5?connection_limit=10"
UPLOAD_DIR=uploads
MAX_UPLOAD_SIZE_MB=5
```

说明：

- `PORT`：后端端口
- `APP_BASE_URL`：后端/公开链接基础域名
- `APP_TIMEZONE`：订单号与今日统计使用的时区
- `JWT_SECRET`：JWT 加密密钥
- `DATABASE_URL`：MySQL 连接串
- `UPLOAD_DIR`：本地上传目录
- `MAX_UPLOAD_SIZE_MB`：单图大小限制

### 前端环境变量

文件示例：[frontend/.env.example](./frontend/.env.example)

```env
VITE_API_BASE_URL=http://localhost:3000
```

说明：

- 本地开发时，前端会请求这个地址下的 `/api/v1`
- 若前后端分域部署，把它改成正式后端域名

## 9. 图片上传说明

当前版本使用后端本地磁盘存储：

- 上传接口：`POST /api/v1/uploads/images`
- 静态访问前缀：`/uploads/...`
- 默认上传目录：`backend/uploads/images`

注意：

- 当前限制图片格式为 `jpg/png/webp`
- 默认单张图片大小限制为 `5MB`
- 生产环境建议迁移到 OSS / COS / S3 / MinIO

## 10. 默认账号说明

由 seed 脚本初始化：

### 运营端

- 用户名：`operator`
- 密码：`Operator@123`

### 仓库端

- 用户名：`warehouse`
- 密码：`Warehouse@123`

## 11. 订单号规则说明

订单号格式：

```text
ZN + 日期 + 当日流水号
```

示例：

```text
ZN20260330001
ZN20260330002
```

规则说明：

- 固定前缀：`ZN`
- 日期部分：`YYYYMMDD`
- 流水号部分：按当天从 `001` 开始递增

后端通过 `order_sequences` 表在事务中锁定当天序号，避免并发下重复。

## 12. 客户订单访问链接说明

每笔订单在创建后都会生成：

- 一个独立订单号
- 一个独立安全 token
- 一个仅对应本次订单的前台访问链接

访问规则：

- 客户访问时必须使用 `orderNo + token`
- 客户端默认只能看到本次订单
- 不显示历史订单
- 不显示内部备注
- 不显示仓库备注

链接示例：

```text
https://h5.example.com/client/orders/ZN20260330001?token=xxxxxx
```

## 13. 部署建议

最小可上线版本建议：

- 前端和后端都使用 HTTPS
- 前端部署到静态站点或 Nginx
- 后端部署到 1 台 Node.js 服务
- 数据库使用托管 MySQL 或单独云主机 MySQL
- 图片优先放对象存储，避免后端本地磁盘膨胀
- 使用反向代理统一域名与证书

更详细的部署建议见：

- [部署建议](./docs/deployment-guide.md)

## 14. 微信内置浏览器适配注意事项

- 页面必须是 HTTPS，微信内置浏览器对非 HTTPS 场景更容易出现限制
- 尽量避免依赖微信开放平台能力，当前版本已按普通 H5 设计
- 页面视口已做移动端与安全区适配，但仍建议真机测试
- 上传图片、弹窗、复制链接、回退行为都需要在微信里再次验证
- iOS 微信和 Android 微信都要测试一次
- 避免首屏资源过大，控制图片和 JS 体积

## 补充文档

- 联调检查清单：[docs/integration-checklist.md](./docs/integration-checklist.md)
- 部署建议：[docs/deployment-guide.md](./docs/deployment-guide.md)
- 后端说明：[backend/README.md](./backend/README.md)
- 前端说明：[frontend/README.md](./frontend/README.md)
