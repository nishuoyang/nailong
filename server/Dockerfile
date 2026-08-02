FROM node:20-slim AS builder
WORKDIR /app

# bcrypt 等原生模块编译依赖
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./
RUN npm ci
COPY server/ .
RUN npx prisma generate
RUN npm run build

FROM node:20-slim
WORKDIR /app

# Prisma 引擎需要 OpenSSL
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/entrypoint.sh ./
COPY --from=builder /app/seed.js ./

# 客户端构建产物由 docker-compose.prod.yml 卷挂载提供
RUN mkdir -p /app/data /app/client-dist
RUN chmod +x entrypoint.sh

EXPOSE 3000
CMD ["./entrypoint.sh"]
