# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# Nai Long（奶龙）图片展示平台

## 项目概述

图片展示社区平台，功能包括：
- 图片浏览（瀑布流列表、详情、搜索、分类筛选、三栏布局）
- 精选推荐（管理员手动标记）/ 其他推荐（独立 section，管理员上传）/ 每周排行榜 / 每日推荐
- 用户注册/登录（JWT + 验证码），个人主页（bio 可编辑，需审核）
- 用户上传图片（sharp 生成缩略图，管理员审核后公开可见）
- 点赞/下载互动（显示计数，下载通过服务端代理）
- 后台管理（审核、上下架、删除、精选标记、分类管理、用户管理、设置）
- 暗色/白天模式切换

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Vue 3 + TypeScript + Vite |
| UI | Tailwind CSS v4 + Element Plus |
| 路由 | Vue Router 4 |
| 数据请求 | @tanstack/vue-query |
| 状态管理 | Pinia |
| 后端 | NestJS + TypeScript |
| ORM | Prisma + SQLite（文件数据库，零配置） |
| 缓存 | Redis 7 |
| 文件存储 | MinIO（开发）→ 阿里云 OSS/腾讯云 COS（生产） |
| 认证 | JWT Access + Refresh Token |

## 常用命令

```bash
# 开发环境
cd server && npm run start:dev    # 后端 :3000
cd client && npm run dev          # 前端 :5173

# 数据库
cd server
npx prisma migrate dev --name xxx # 创建 migration
npx prisma generate               # 重新生成 Prisma client
npx prisma studio                 # 数据库可视化

# 构建
cd server && npm run build
cd client && npm run build

# Docker（Redis + MinIO，不含数据库）
docker compose up -d
```

## 关键设计约定

1. **API 响应格式**：统一 `{code: 0, message: "ok", data: ..., meta?: {...}}`，分页时 meta 在顶层
2. **数据库**：SQLite 文件 `server/prisma/data.db`，无需 Docker 容器。Schema 中的 `status`/`section`/`role` 等全是 `String` 类型（非 enum，因为 SQLite 不支持）
3. **图片状态机**：`pending → approved/rejected`；`approved → offline`（下架）；`offline → approved`（重新上架）
4. **点赞 toggle**：同一接口，INSERT 或 DELETE + 事务内更新 `likeCount`，直接解构事务返回值
5. **上传限制**：仅 jpeg/png/webp，≤10MB，每用户每日 ≤50 张
6. **路由守卫**：meta.requiresAuth（需登录）、meta.requiresAdmin（需管理员角色）
7. **存储透明**：Prisma 只存 URL 字符串，切换 MinIO/OSS/COS 不改 schema
8. **JWT 公开端点**：`@Public()` 端点手动解析 JWT（不通过 Passport），有 token 则设 `request.user`，无则放行
9. **图片 section**：`general`（发现页）/ `other`（其他推荐页），发现页只查 `section=general`
10. **首页布局**：三栏 `xl:block`，左右侧栏在 <1280px 时同时隐藏
11. **验证码**：`svg-captcha` 生成，答案存 Redis，5 分钟过期不区分大小写
12. **每日推荐**：随机选 approved 图片，Redis 缓存到次日凌晨 4 点
13. **暗色模式**：`localStorage('theme')`，`<html class="dark">` + Tailwind `dark:` variant，右下角 ⚙️ 浮动按钮

## 项目结构

```
nailong/
├── client/src/
│   ├── api/               # auth.ts, images.ts, upload.ts, admin.ts
│   ├── components/
│   │   ├── common/        # ImageCard, SearchBar, Pagination
│   │   └── layout/        # AppLayout, ProfileLayout
│   ├── pages/
│   │   ├── HomePage, ImageDetailPage, SearchPage
│   │   ├── LoginPage, RegisterPage, ProfilePage, UploadPage
│   │   ├── FeaturedPage, OtherPage, UserProfilePage
│   │   └── admin/         # Dashboard, ImageManage, UserManage, CategoryManage, Settings
│   ├── router/            # 路由配置 + beforeEach 守卫（含 restoreUser）
│   ├── stores/            # auth.ts（含 restoreUser）
│   └── utils/             # request.ts（axios 实例 + 401 自动刷新 token）
├── server/src/
│   ├── auth/              # 认证（register/login/refresh/captcha，JWT strategy + guard）
│   ├── users/             # 用户 CRUD + bio + 公开主页
│   ├── images/            # 公开接口（列表/详情/搜索/featured/other/daily/leaderboard/文件代理）
│   ├── upload/            # 上传 + MinIO + sharp 缩略图（300px/800px）
│   ├── likes/             # 点赞 toggle + 下载计数
│   ├── admin/             # 审核/上下架/删除/精选/分类管理/设置
│   ├── common/            # guards/decorators/filters/interceptors
│   ├── prisma/            # PrismaModule + PrismaService
│   ├── redis/             # RedisModule + RedisService
│   └── minio/             # 共享 MinioModule（@Global），ensureBucket + 公开读策略
└── docker-compose.yml     # Redis + MinIO（无 PostgreSQL）
```

## 图片尺寸规格

- `_thumb_sm`：300px 宽（列表卡片）
- `_thumb_md`：800px 宽（详情预览）
- 原图：保留原始分辨率
