# 奶龙（Nai Long）图片展示平台

Vue 3 + NestJS 全栈图片展示社区平台。支持图片浏览、上传、点赞、下载、管理员审核等完整功能。

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Vue 3 + TypeScript + Vite + Tailwind CSS + Element Plus |
| 后端 | NestJS + TypeScript + Prisma + SQLite |
| 缓存 | Redis |
| 文件存储 | MinIO（可替换为阿里云 OSS / 腾讯云 COS） |
| 认证 | JWT Access + Refresh Token |

## 功能

- 🖼️ 图片瀑布流浏览、搜索、分类筛选
- 📌 精选推荐（管理员手动标记）/ 其他推荐 / 每周排行榜 / 每日推荐
- 👤 用户注册（验证码）/ 登录（JWT）/ 个人主页 / 个人介绍
- 📤 图片上传（sharp 缩略图 + 管理员审核）
- ❤️ 点赞 / 下载互动
- 🔧 后台管理（图片审核、上下架、精选、分类、用户管理、Bio 审核、系统设置）
- 🌓 暗色 / 白天模式

## 本地开发

```bash
# 1. 启动依赖服务
docker compose up -d

# 2. 初始化数据库
cd server
npm install
npx prisma migrate dev --name init
npx prisma db seed

# 3. 启动后端（http://localhost:3000）
npm run start:dev

# 4. 新终端，启动前端（http://localhost:5173）
cd ../client
npm install
npm run dev
```

**测试账号：**

| 角色 | 邮箱 | 密码 |
|---|---|---|
| 普通用户 | user@nailong.com | user123 |

## Docker 生产部署

```bash
# 1. 配置环境变量
cp .env.production server/.env
# 编辑 server/.env，用 openssl rand -hex 32 生成 JWT 密钥

# 2. 一键启动
docker compose -f docker-compose.prod.yml up -d --build
```

访问 `http://<服务器IP>` 即可。

## 项目结构

```
nailong/
├── client/              # Vue 3 前端
│   └── src/
│       ├── api/              # API 请求层
│       ├── components/       # 通用组件
│       ├── pages/            # 页面组件 + admin/
│       ├── router/           # 路由 + 守卫
│       ├── stores/           # Pinia 状态
│       └── utils/            # Axios 实例
├── server/              # NestJS 后端
│   ├── prisma/               # Schema + Migration
│   └── src/
│       ├── auth/             # 认证模块
│       ├── users/            # 用户模块
│       ├── images/           # 图片公开接口
│       ├── upload/           # 上传 + MinIO
│       ├── likes/            # 点赞 + 下载
│       ├── admin/            # 后台管理
│       ├── common/           # Guard/Filter/Interceptor
│       ├── prisma/           # Prisma 服务
│       ├── redis/            # Redis 服务
│       └── minio/            # MinIO 服务
├── docker-compose.yml        # 开发环境
└── docker-compose.prod.yml   # 生产环境
```
