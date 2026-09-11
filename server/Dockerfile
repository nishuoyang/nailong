# ── 阶段 1：构建服务端 ──
FROM node:20-slim AS server-builder
WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./
RUN npm ci
COPY server/ .
RUN npx prisma generate
RUN npm run build

# ── 阶段 2：构建客户端 ──
FROM node:20-slim AS client-builder
WORKDIR /app

COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

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
