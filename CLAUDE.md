# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# Nai Long（奶龙）图片展示平台

## 项目概述

奶龙主题图片社区「奶龙宇宙」，功能包括：
- 图片浏览（瀑布流列表、详情、搜索、分类/标签筛选、精选/其他推荐）
- 排行榜（周/月）、每日推荐、站点统计
- 用户注册/登录（JWT + 验证码），个人主页（bio 可编辑，需审核）
- 用户上传图片（sharp 生成缩略图、主色/模糊占位，管理员审核后公开可见）
- 点赞 / 下载 / 收藏 / 收藏夹（公开或私密）
- 评论、关注创作者、关注动态流、标签聚合页、相关推荐
- 全局命令面板（Ctrl/⌘ + K）、表情包工坊（纯前端 canvas）
- 后台管理（审核、上下架、删除、精选、评论、分类、用户、简介、设置）
- 暖色纸感 / 暗色模式切换

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Vue 3 + TypeScript + Vite |
| UI | Tailwind CSS v4 + 本地 UI 组件 + 自托管 Smiley Sans |
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
cd client && npm run build            # 含类型检查（推送前必须跑一次）

# 类型检查（也含在 client 的 build 里，可单独跑）
cd client && npm run typecheck
cd client && npm run build:assets     # 只打包不检查 —— 镜像构建用的是这个

# Docker（Redis + MinIO，不含数据库）
docker compose up -d
```

> ⚠️ **`client` 的「类型检查」与「打包」是分开的两件事。**
> `server/Dockerfile` 的镜像构建只跑 `npm run build:assets`（即 `vite build`），**不跑** `vue-tsc -b`，
> 所以**推送前必须在本地跑一次 `npm run build` 或 `npm run typecheck`**，否则类型错误不会被任何环节拦住。
>
> 这么分是因为在生产机上跑 `vue-tsc -b` 会拖垮整机：2026-09-11 实测它单独跑了 1016 秒未结束、
> RSS 315MB，把 2 vCPU / 1.6GB 的机器压到 iowait 41%、load 44，**站点中断 18 分钟**。
> 详见 `docs/性能优化记录-20260910.md` 第 12.10 节。

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
10. **首页布局**：编辑式 Hero（左文右每日推荐）+ 横向热榜 + 筛选/标签栏 + 瀑布流；旧的三栏模板已移除
11. **验证码**：`svg-captcha` 生成，答案存 Redis，5 分钟过期不区分大小写
12. **每日推荐**：随机选 approved 图片，Redis 缓存到次日凌晨 4 点
13. **暗色模式**：`theme-init.js` 在首屏前读取 `localStorage('theme')` / 系统偏好，`<html class="dark">` + Tailwind `dark:` variant；设计 token 在 `client/src/style.css`，主题切换在顶部导航
14. **社区数据**：评论/收藏/关注/标签均为独立表；Image 上的 `commentCount`/`favoriteCount` 在写操作事务内维护，列表页不做 N+1 计数
15. **图片占位**：上传时由 sharp 生成 `dominantColor` 与极小 `blurDataUrl`（data URI），列表先铺占位再换清晰图
16. **验证码降级**：Redis 正常时验证码存 Redis；Redis 不可用时返回带 HMAC 答案的 5 分钟签名挑战，注册不因缓存故障整体不可用
17. **新 API**：`/api/comments`、`/api/favorites`、`/api/collections`、`/api/follows`、`/api/tags`、`/api/feed`、`/api/related`、`/api/stats`；公开端点用 `@Public()`，其余走全局 JWT guard

## 项目结构

```
nailong/
├── client/src/
│   ├── api/               # auth.ts, images.ts, social.ts, upload.ts, admin.ts, index.ts
│   ├── components/
│   │   ├── common/        # ImageCard, ImageGrid, PageHeader, CollectionCard/Form/Picker
│   │   └── layout/        # AppLayout, SiteHeader/Footer, AdminShell, AuthShell, CommandPalette
│   ├── components/ui/     # BrandMark, AppIcon, UiModal, UiButton, ToastHost
│   ├── composables/       # useTheme, useCommandPalette, useToast
│   ├── pages/
│   │   ├── HomePage, ImageDetailPage, SearchPage, TagPage
│   │   ├── LoginPage, RegisterPage, ProfilePage, UploadPage, UserProfilePage
│   │   ├── FeaturedPage, OtherPage, CollectionsPage, CollectionDetailPage, FeedPage
│   │   └── admin/         # Dashboard, ImageManage, CommentManage, BioReview, UserManage, CategoryManage, Settings
│   ├── router/            # 路由配置 + beforeEach 守卫（含 restoreUser）+ 标题/滚动
│   ├── stores/            # auth.ts（含 restoreUser）
│   └── utils/             # request.ts（axios 实例 + 401 自动刷新 token）
├── server/src/
│   ├── auth/              # 认证（register/login/refresh/captcha，JWT strategy + guard）
│   ├── users/             # 用户 CRUD + bio + 公开主页
│   ├── images/            # 公开接口（列表/详情/相关推荐/搜索/featured/other/daily/leaderboard/stats/文件代理）
│   ├── upload/            # 上传 + MinIO + sharp 缩略图/占位图
│   ├── likes/             # 点赞 toggle + 下载计数
│   ├── comments/          # 评论列表/发表/删除
│   ├── favorites/         # 收藏 toggle / 我的收藏
│   ├── collections/       # 收藏夹 CRUD / 成员管理
│   ├── follows/           # 关注 toggle / 粉丝列表 / 关注动态
│   ├── tags/              # 标签列表 / 标签详情
│   ├── admin/             # 审核/上下架/删除/精选/评论/分类/设置/统计
│   ├── common/            # guards/decorators/filters/interceptors
│   ├── prisma/            # PrismaModule + PrismaService
│   ├── redis/             # RedisModule + RedisService
│   └── minio/             # 共享 MinioModule（@Global），ensureBucket + 公开读策略
├── client/public/fonts/   # Smiley Sans（OFL，自托管）
└── docker-compose.yml     # Redis + MinIO（无 PostgreSQL）
```

## 图片尺寸规格

- `_thumb_sm`：300px 宽（列表卡片）
- `_thumb_md`：800px 宽（详情预览）
- 原图：保留原始分辨率