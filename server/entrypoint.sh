#!/bin/sh
set -e

# 用仓库内的 prisma 二进制，**不用 npx**。
#
# npx 的行为是：本地 node_modules/.bin 里找不到就**去 registry 下载**。
# 也就是说，一旦 prisma CLI 因为任何原因不在镜像里（例如又被挪回 devDependencies、
# 或 npm prune 把它删掉），npx 不会立刻报错，而是挂在那里尝试联网 —— 
# 在一个启动路径上，这等于「容器卡死不提供服务」，而不是「快速失败」。
# 直接调用本地路径，缺失时立刻以非零码退出，失败模式是明确且立即可见的。
PRISMA_BIN=./node_modules/.bin/prisma

if [ ! -x "$PRISMA_BIN" ]; then
  echo "FATAL: 找不到 $PRISMA_BIN" >&2
  echo "        prisma CLI 必须位于 dependencies（而非 devDependencies）中，" >&2
  echo "        否则镜像构建的 npm prune --omit=dev 会把它删除。" >&2
  exit 1
fi

echo "Running database migration..."
"$PRISMA_BIN" migrate deploy

echo "Seeding initial data..."
node seed.js

echo "Starting server..."
exec node dist/src/main
