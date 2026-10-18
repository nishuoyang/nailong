# 奶龙宇宙（Nai Long Universe）

Vue 3 + NestJS 全栈图片社区。看图、收藏、评论、关注创作者，也可以在浏览器里三秒做一张表情包。

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Vue 3 + TypeScript + Vite + Tailwind CSS v4 + 本地 UI 组件（按需） |
| 后端 | NestJS + TypeScript + Prisma + SQLite |
| 缓存 | Redis（验证码 / 视图计数 / 每日推荐；不可用时自动降级） |
| 文件存储 | MinIO（可替换为阿里云 OSS / 腾讯云 COS） |
| 认证 | JWT Access + Refresh Token |
| 字体 | Smiley Sans（得意黑，OFL，自托管） |

## 功能

- 🖼️ 图片瀑布流浏览、搜索、分类/标签筛选、精选/其他推荐
- 🏆 每周/每月排行榜、每日推荐、站点统计
- 👤 注册（验证码）/ 登录（JWT）/ 个人主页 / 简介审核
- 📤 图片上传（sharp 缩略图 + 主色/模糊占位）、审核后公开
- ❤️ 点赞 / 下载 / 收藏 / 收藏夹（公开或私密）
- 💬 图片评论、删除自己的评论
- 👥 关注创作者、关注动态流
- 🏷️ 标签体系、标签聚合页、相关推荐
- 🎨 表情包工坊（纯前端 canvas，不上传底图）
- 🔍 全局命令面板（Ctrl / ⌘ + K）
- 🔧 后台管理（审核、上下架、删除、精选、评论、分类、用户、简介、设置）
- 🌓 暖色纸感 / 暗色模式

## 本地开发

```bash
# 1. 启动依赖服务（Redis + MinIO）
docker compose up -d

# 2. 初始化数据库
cd server
npm install
npx prisma migrate dev
npx prisma db seed

# 3. 启动后端（http://localhost:3000）
npm run start:dev

# 4. 新终端，启动前端（http://localhost:5173）
cd ../client
npm install
npm run dev
```

> 种子账号由 `server/seed.js` 按环境变量生成，不再在仓库里写公开口令。
> 本地需要测试账号时，请阅读该脚本顶部的说明并显式设置环境变量。

## 构建

```bash
cd server && npm run build
cd client && npm run build          # 含 vue-tsc 类型检查
cd client && npm run build:assets   # 只打包，镜像构建使用
```

> ⚠️ `build:assets` **不跑类型检查**。推送前必须在本机跑一次 `npm run build` 或
> `npm run typecheck`。生产机是 2 vCPU / 1.6GB，历史上 `vue-tsc -b` 拖垮过整机，
> 所以类型检查从镜像构建里拿掉了。详见 `docs/性能优化记录-20260910.md`。

## Docker 生产部署

```bash
cp .env.production server/.env
# 编辑 server/.env，用 openssl rand -hex 32 生成 JWT 密钥
docker compose -f docker-compose.prod.yml up -d --build
```

容器启动时会执行 `prisma migrate deploy`，新增迁移会自动应用。

## 项目结构

```
nailong/
├── client/
│   ├── public/fonts/         # Smiley Sans（OFL）
│   └── src/
│       ├── api/              # images / social / auth / upload / admin
│       ├── components/
│       │   ├── common/       # ImageCard / ImageGrid / PageHeader / Collection*
│       │   ├── layout/       # AppLayout / SiteHeader / SiteFooter / AdminShell / AuthShell
│       │   └── ui/           # BrandMark / AppIcon / UiModal / UiButton / Toast
│       ├── composables/      # theme / command palette / toast
│       ├── directives/       # v-reveal
│       ├── pages/            # 发现 / 详情 / 搜索 / 收藏夹 / 关注流 / 标签 / 个人 / 后台
│       ├── router/
│       ├── stores/
│       └── utils/
├── server/src/
│   ├── auth/                 # 登录 / 注册 / 验证码（Redis 不可用时签名挑战降级）
│   ├── users/                # 用户 / 简介 / 公开主页统计
│   ├── images/               # 列表 / 详情 / 相关推荐 / 搜索 / 排行 / 统计
│   ├── upload/               # 上传 + sharp 缩略图 + 主色/模糊占位
│   ├── likes/                # 点赞 / 下载
│   ├── comments/             # 评论
│   ├── favorites/            # 收藏
│   ├── collections/          # 收藏夹
│   ├── follows/              # 关注 / 关注动态
│   ├── tags/                 # 标签
│   ├── admin/                # 后台
│   ├── common/               # guards / filters / interceptors / utils
│   ├── prisma/               # PrismaService
│   ├── redis/
│   └── minio/
├── deploy/                   # 服务端发布脚本
├── docker-compose.yml        # 开发 Redis + MinIO
└── docker-compose.prod.yml   # 生产
```

## 图片尺寸

- `_thumb_sm`：300px 宽（列表卡片）
- `_thumb_md`：800px 宽（详情预览）
- 原图：保留原始分辨率
- 上传时额外生成 `dominantColor` 与极小 `blurDataUrl`，用于图片加载前的占位