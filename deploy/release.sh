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
#
# 自 2026-09-12（待办 #6 起）：schema.prisma 变更**不再是硬拦**。
# overlay 的 release.Dockerfile 新增了离线 `prisma generate`（只吃 schema +
# 已装引擎，实测 1.4 秒），容器启动时 entrypoint 还会 `prisma migrate deploy`
# 自动应用迁移 —— 所以 schema-only 变更可以继续走 overlay，不必退回完整构建。
# 但 package*.json 变化仍是硬拦：node_modules 里的原生二进制只有完整构建才动得了。
if [ "${2:-}" != "--skip-guard" ]; then
  echo "==> guard：对照基础镜像 $BASE_IMAGE"
  # npm 版本差异过滤：本地 npm 会在 lock 里给 sharp 的平台包（@img/*-linux-*）
  # 写 "libc"/"os"/"cpu" 元数据块，镜像构建期的 npm 会把这些块规范化删掉。
  # 实测 diff（2026-09-11）只有这些块，不含任何版本/依赖变化；它们不影响安装结果，
  # 逐字节比较会永远误报。这个过滤对 package.json / schema.prisma 是 no-op
  # （它们没有这种块）。
  norm() { sed -E '/^[[:space:]]*"(libc|os|cpu)": \[/,/^[[:space:]]*\]/d'; }

  # mode=fatal（默认）：不一致即中止；mode=warn：不一致只告警（见上面的 schema 说明）
  guard_eq() {
    local uploaded="$1" image_path="$2" mode="${3:-fatal}" tmp_img tmp_up
    tmp_img="$(mktemp)"; tmp_up="$(mktemp)"
    # 行尾归一化再比较：本地（Windows checkout）的 package*.json 可能是 CRLF，
    # 镜像里是构建时的 LF —— 逐字节比较会把「行尾差异」误判成依赖变化
    # （2026-09-11 实测踩到：package.json 66 个 CR vs 镜像 0 个，guard 误报）。
    # 删掉 \r 后比的是内容本身；真正的依赖变更不会被归一化掩盖。
    if ! docker run --rm --entrypoint sh "$BASE_IMAGE" -c "cat '$image_path'" 2>/dev/null | tr -d '\r' | norm > "$tmp_img"; then
      echo "FATAL: 无法从基础镜像读取 $image_path" >&2
      rm -f "$tmp_img" "$tmp_up"; exit 1
    fi
    tr -d '\r' < "$uploaded" | norm > "$tmp_up"
    if ! cmp -s "$tmp_up" "$tmp_img"; then
      if [ "$mode" = "warn" ]; then
        echo "WARN: $image_path 与基础镜像不一致 —— Prisma schema 变更。"
        echo "      overlay 将重新生成 Prisma Client；容器启动时 entrypoint 会 migrate deploy。"
      else
        echo "FATAL: $uploaded 与基础镜像里的 $image_path 内容不一致 ——" >&2
        echo "      依赖有变化，overlay 无法处理（原生二进制需要 npx ci）。" >&2
        echo "      请改用完整构建：$COMPOSE_CMD -f $REPO/docker-compose.prod.yml build server" >&2
        rm -f "$tmp_img" "$tmp_up"; exit 1
      fi
    else
      echo "  OK: $image_path 一致（行尾已归一化）"
    fi
    rm -f "$tmp_img" "$tmp_up"
  }
  guard_eq package.json /app/package.json
  guard_eq package-lock.json /app/package-lock.json
  guard_eq prisma/schema.prisma /app/prisma/schema.prisma warn
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