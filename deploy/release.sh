#!/bin/bash
#
# 发布管线 · 服务器端（待办 #3「构建搬到本地/CI」）
#
# 用法：  <repo>/deploy/release.sh <shortsha> [--skip-guard]
#
# 前置（在本地完成，见 docs/build-release.ps1）：
#   - 产物已上传到 /root/releases/<sha>.tar.gz，
#     内含 dist/ client-dist/ prisma/ seed.js entrypoint.sh scripts/ package*.json
#   - 本仓库已 git pull（release.sh 与 release.Dockerfile 是新文件，需先在服务器上）
#
# 流程：guard（依赖/schema 未变）→ 快照回滚点 → overlay 构建（2~3 秒）→ 重打
#       nailonghub-server:latest → compose 重建 server（优雅关闭，无 502 窗口）→ 冒烟。
#
# 回滚：docker tag nailonghub-server:pre-<sha> nailonghub-server:latest
#       然后 <COMPOSE_CMD> -f docker-compose.prod.yml up -d --no-build --force-recreate --no-deps server
set -euo pipefail

SHA="${1:?usage: release.sh <shortsha> [--skip-guard]}"
REPO="/root/nailonghub"
RELEASES="/root/releases"
RELEASE_DIR="$RELEASES/$SHA"
TARBALL="$RELEASES/$SHA.tar.gz"
BASE_IMAGE="nailonghub-server:latest"

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif docker-compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "FATAL: 找不到 docker compose" >&2
  exit 1
fi

echo "==> release.sh $SHA（$COMPOSE_CMD）"

# ── 0. 产物 ──
[ -f "$TARBALL" ] || { echo "FATAL: $TARBALL 不存在" >&2; exit 1; }
if [ ! -d "$RELEASE_DIR" ]; then
  echo "==> 解压产物"
  mkdir -p "$RELEASE_DIR"
  tar -xzf "$TARBALL" -C "$RELEASE_DIR"
fi
cd "$RELEASE_DIR"

# ── 1. guard：依赖 / Prisma schema 是否与基础镜像一致 ──
# overlay 不能处理三类变化：package.json、package-lock.json（node_modules）、
# schema.prisma（Prisma Client）。对照基础镜像里的**实际文件**校验，
# 而不是对 git 历史做假设 —— 万一基础镜像不是你以为的那个 commit，也能拦住。
if [ "${2:-}" != "--skip-guard" ]; then
  echo "==> guard：对照基础镜像 $BASE_IMAGE"
  guard_eq() {
    local uploaded="$1" image_path="$2" tmp
    tmp="$(mktemp)"
    if ! docker run --rm --entrypoint sh "$BASE_IMAGE" -c "cat '$image_path'" >"$tmp" 2>/dev/null; then
      echo "FATAL: 无法从基础镜像读取 $image_path" >&2
      rm -f "$tmp"; exit 1
    fi
    if ! cmp -s "$tmp" "$uploaded"; then
      echo "FATAL: $uploaded 与基础镜像里的 $image_path 不一致 ——" >&2
      echo "      依赖或 Prisma schema 有变化，overlay 无法处理（原生二进制需要 npx ci/prisma generate）。" >&2
      echo "      请改用完整构建：$COMPOSE_CMD -f $REPO/docker-compose.prod.yml build server" >&2
      rm -f "$tmp"; exit 1
    fi
    rm -f "$tmp"
    echo "  OK: $image_path 一致"
  }
  guard_eq package.json /app/package.json
  guard_eq package-lock.json /app/package-lock.json
  guard_eq prisma/schema.prisma /app/prisma/schema.prisma
else
  echo "==> --skip-guard：跳过依赖/schema 一致性检查（生产上不要这么干）"
fi

# ── 2. 快照回滚点 ──
# 从当前 latest 打快照 —— 这是发布前一刻的镜像，回滚直接指回它。
docker tag "$BASE_IMAGE" "nailonghub-server:pre-$SHA"
echo "==> 回滚快照: nailonghub-server:pre-$SHA"

# ── 3. overlay 构建 ──
echo "==> overlay 构建（上下文 $RELEASE_DIR）"
docker build -f "$REPO/deploy/release.Dockerfile" -t "nailonghub-server:release-$SHA" "$RELEASE_DIR"

# ── 4. 重打 latest 并重建 server ──
docker tag "nailonghub-server:release-$SHA" "$BASE_IMAGE"
echo "==> 重建 server（优雅关闭，新容器起来前 Caddy 会挂住重试）"
cd "$REPO"
$COMPOSE_CMD -f docker-compose.prod.yml up -d --no-build --force-recreate --no-deps server

# ── 5. 冒烟：等健康检查通过 ──
echo "==> 等待 /api/health（最多 90 秒）"
smoke_ok=0
for _ in $(seq 1 45); do
  if docker exec nailong-server node -e \
    "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    >/dev/null 2>&1; then
    smoke_ok=1
    break
  fi
  sleep 2
done
if [ "$smoke_ok" != "1" ]; then
  echo "FATAL: 90 秒内 /api/health 未通过，回滚命令见本文件头部注释" >&2
  $COMPOSE_CMD -f docker-compose.prod.yml ps server || true
  exit 1
fi
echo "==> health OK"

# ── 6. 现场记录 ──
docker ps --filter name=nailong-server --format '  {{.ID}}  {{.Image}}  {{.Status}}'
docker images nailonghub-server --format '  {{.Repository}}:{{.Tag}}  {{.ID}}  {{.Size}}'
echo "==> 完成。滚动清理旧 release-/pre- 镜像（保留本次）后记得核对日志与接口行为。"