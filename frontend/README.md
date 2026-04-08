# 微信成交后订单录单 H5 前端

前端基于 `Vue 3 + TypeScript + Vite + Vant + Pinia + Vue Router`。

## 目录结构

```text
frontend/
├─ src/
│  ├─ api/
│  ├─ components/
│  ├─ constants/
│  ├─ layouts/
│  ├─ router/
│  ├─ stores/
│  ├─ styles/
│  ├─ types/
│  ├─ utils/
│  └─ views/
├─ .env.example
├─ index.html
├─ package.json
└─ vite.config.ts
```

## 安装与启动

```bash
cd frontend
npm install
npm run dev
```

默认地址：

```text
http://localhost:5173
```

## 环境变量

复制示例文件：

```bash
cp .env.example .env
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

示例内容：

```env
VITE_API_BASE_URL=http://localhost:3000
```

说明：

- 开发环境下，`vite.config.ts` 已把 `/api` 和 `/uploads` 代理到后端
- 如果前后端分域部署，把 `VITE_API_BASE_URL` 改成后端域名即可

## 已实现页面

- 登录页
- 运营端新建订单页
- 运营端订单列表页
- 运营端订单详情页
- 今日订单后台表页
- 客户详情页
- 仓库待发货订单列表页
- 仓库发货页
- 客户本次订单查看页

## 路由

- `/login`
- `/operator/orders/create`
- `/operator/orders`
- `/operator/orders/:id`
- `/operator/today-orders`
- `/operator/customers/:mobile`
- `/warehouse/orders/pending`
- `/warehouse/orders/:id/ship`
- `/client/orders/:orderNo?token=xxx`

## 与后端对接的接口

- `POST /api/v1/auth/login`
- `POST /api/v1/orders`
- `GET /api/v1/orders`
- `GET /api/v1/orders/:id`
- `PATCH /api/v1/orders/:id`
- `GET /api/v1/customers/identify`
- `GET /api/v1/warehouse/orders/pending`
- `POST /api/v1/warehouse/orders/:id/ship`
- `GET /api/v1/public/orders/:orderNo`
- `POST /api/v1/uploads/images`
- `GET /api/v1/stats/today-orders`

## 当前前端对后端能力的兼容说明

基于你前一轮确认并已落地的后端接口，前端做了以下兼容处理：

- “保存草稿”当前保存到浏览器本地 `localStorage`
- 客户详情页使用“手机号识别老客户接口”承接客户基础信息和历史订单摘要
- “作废订单”按钮已放在详情页，但当前后端还没有作废接口，因此前端只做提示
- 创建阶段的“仓库备注”会并入内部备注串保存；仓库端待发货接口目前还不能单独返回它

如果下一步你愿意，我可以继续直接补第 2 轮，把这些缺口对应的后端接口一起补齐，然后把前端同步接成完整闭环。
