# ── 阶段 1：构建服务端 ──
FROM node:20-slim AS server-builder
WORKDIR /app

# 给构建进程一个堆上限。
# 目的不是省内存，而是把失控时的失败模式从「把整机拖死、站点不可访问」
# 换成「构建报错失败」—— 旧容器仍在服务，重跑即可。
# 实测本项目各步骤的 RSS：nest build ~155MB、vite build ~200MB、npm ci 更低，
# 512MB 有充足余量。
ENV NODE_OPTIONS=--max-old-space-size=512

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./
RUN npm ci
COPY server/ .
RUN npx prisma generate
RUN npm run build

# ── 阶段 2：构建客户端 ──
FROM node:20-slim AS client-builder
WORKDIR /app

ENV NODE_OPTIONS=--max-old-space-size=512

COPY client/package*.json ./
RUN npm ci
COPY client/ .
# ⚠️ 这里跑的是 build:assets（只打包），**不是** npm run build（含 vue-tsc -b）。
#
# 原因：2026-09-11 的发布事故就是这么来的。在生产实例（2 vCPU / 1.6GB / 当时无 swap）上，
# vue-tsc -b 单独跑了 1016 秒仍未结束、RSS 315MB，与并行的 nest build 一起把页缓存挤空，
# 整机 iowait 冲到 41.2%、load 44，连 Caddy 都拿不到 CPU —— 站点中断 18 分钟。
# 同一个 vue-tsc -b 在本地只需数秒，所以问题不是「CPU 慢」而是内存不足。
#
# 类型检查改为在推送前的本地/CI 完成（`npm run build` 或 `npm run typecheck`）。
# 镜像构建只负责打包，这是「构建产物」与「质量门禁」的职责分离 ——
# 而且类型错误本来也不该等到生产机上构建时才发现。
RUN npm run build:assets

# ── 阶段 3：运行镜像 ──
FROM node:20-slim
WORKDIR /app

# Prisma 引擎需要 OpenSSL
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# 服务端产物
COPY --from=server-builder /app/dist ./dist
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/prisma ./prisma
COPY --from=server-builder /app/package*.json ./
COPY --from=server-builder /app/entrypoint.sh ./
COPY --from=server-builder /app/seed.js ./
# 运维脚本（冒烟测试、存量数据修复）。放进镜像后可以直接在容器里跑，
# 例如：docker exec nailong-server node scripts/backfill-object-meta.js --apply
# 脚本会读挂载进来的 /app/.env，因此用的是与运行时完全一致的配置。
COPY --from=server-builder /app/scripts ./scripts

# 客户端产物（Docker 内构建，无需手动 npm run build）
COPY --from=client-builder /app/dist ./client-dist

RUN mkdir -p /app/data
RUN chmod +x entrypoint.sh

EXPOSE 3000
CMD ["./entrypoint.sh"]
