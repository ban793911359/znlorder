# 部署建议

## 1. 域名

最小可上线版本建议使用两个域名或子域名：

- 前端 H5：`https://h5.example.com`
- 后端 API：`https://api.example.com`

如果你希望配置更简单，也可以使用同一主域下的路径转发：

- 前端：`https://example.com/`
- 后端：`https://example.com/api/`

优先建议：

- 前后端使用同一主域，方便后续跨域、Cookie、分享链接和微信访问控制

## 2. HTTPS

必须启用 HTTPS。

原因：

- 微信内置浏览器对非 HTTPS 支持较差
- 图片上传、分享打开、移动端访问都更稳定
- 后续如要接入更多移动端能力，也基本都要求 HTTPS

建议：

- 使用 Nginx + Let's Encrypt
- 或直接使用云平台自带 HTTPS 证书服务

## 3. 数据库

最小可上线版本建议：

- 使用独立 MySQL 8
- 不建议把数据库和前端静态文件混在一台临时机器里长期运行

推荐方案：

- 云数据库 MySQL
- 或一台云服务器单独安装 MySQL，并限制访问来源

注意：

- 开启每日自动备份
- 设置强密码
- 仅允许后端服务所在机器访问

## 4. 文件存储

开发环境：

- 可以先用本地磁盘存储

生产环境建议：

- 阿里云 OSS
- 腾讯云 COS
- AWS S3
- MinIO

原因：

- 本地磁盘不适合长期保存图片
- 容易丢失、难迁移、扩容麻烦
- 多实例部署时会出现文件不一致

## 5. 前端部署

最小可上线版本：

- `npm run build`
- 将 `frontend/dist` 部署到 Nginx 静态目录

建议：

- 开启 gzip 或 brotli
- 资源文件开启长期缓存
- 路由使用 history 模式时，Nginx 要做回退到 `index.html`

Nginx 示例思路：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## 6. 后端部署

最小可上线版本：

- 一台 Node.js 服务
- 使用 PM2 或 systemd 守护

建议流程：

1. 上传代码
2. 配置 `.env`
3. 执行 `npm install`
4. 执行 `npm run prisma:generate`
5. 执行 `npm run prisma:deploy`
6. 执行 `npm run start:prod`

更稳的方式：

- 使用 Docker 打包
- 使用 PM2 管理进程
- 用 Nginx 反向代理 `/api`

## 7. 日志和错误排查

最小版本建议至少保留：

- Node.js 控制台日志
- Nginx 访问日志
- Nginx 错误日志
- MySQL 慢查询日志

重点关注：

- 登录失败
- 图片上传失败
- 创建订单失败
- 公开订单 token 校验失败
- 仓库发货失败

建议后续补充：

- 请求 ID
- 结构化日志
- 错误告警
- Sentry 或类似异常采集

## 8. 最小可上线配置建议

如果你希望先以最低复杂度上线，建议这一套：

- 1 台云服务器：2C4G
- 1 个 MySQL 实例
- 1 个对象存储桶
- 1 个 Nginx
- 1 个 Node.js 后端进程
- 1 份前端静态文件

对应架构：

```text
用户微信浏览器
   ↓ HTTPS
Nginx
   ├─ 前端静态文件
   └─ /api -> Node.js NestJS
                ├─ MySQL
                └─ 对象存储
```

## 9. 上线前检查

- 域名已备案并可访问
- HTTPS 证书有效
- 前端环境变量已指向正式 API
- 后端 `APP_BASE_URL` 已配置正式域名
- MySQL 已执行 migration
- seed 只在测试环境执行，生产环境谨慎执行
- 图片上传目录或对象存储权限正常
- 微信里可正常打开公开订单链接
