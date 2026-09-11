#!/bin/bash
#
# ⚠️ 这个脚本用 bash 而非 sh（2026-09-11 起）。
# 原因只有一个但很硬：下面要用 `cmd | tee -a "$APP_LOG"` 把启动阶段的输出
# 同时送进 stdout 和日志文件，而**管道的退出码是 tee 的** —— `prisma migrate deploy`
# 失败会被无声地吃掉，`set -e` 也就形同虚设，容器会带着一个没迁移完的库继续启动。
# 只有 bash 有 `pipefail` 能修正这一点（debian 的 /bin/sh 是 dash，没有 pipefail）。
# bash 在 node:20-slim 里是有的（实测 GNU bash 5.2.15）。
#
set -euo pipefail

# ── 启动阶段的日志落盘 ──
# 目的与 AppFileLogger 一致：`docker logs` 只读当前容器，而每次发布都换新容器，
# 旧日志随之消失。迁移/播种的输出虽然只在启动时出现，但「上一次发布到底跑了什么迁移」
# 恰恰是事后最常要回答的问题之一。
# 日志目录不可写时**不报错退出** —— 记日志的问题绝不能拦住建站。
LOG_DIR="${LOG_DIR:-/app/logs}"
APP_LOG="$LOG_DIR/${LOG_FILE:-app.log}"
if mkdir -p "$LOG_DIR" 2>/dev/null && [ -w "$LOG_DIR" ]; then
  :
else
  echo "WARN: 日志目录 $LOG_DIR 不可写，启动阶段的输出只进 stdout" >&2
  APP_LOG=""
fi

# 同时输出到 stdout 与日志文件。依赖上面的 `set -o pipefail` 保证退出码不被 tee 吃掉。
run_logged() {
  if [ -n "$APP_LOG" ]; then
    "$@" 2>&1 | tee -a "$APP_LOG"
  else
    "$@"
  fi
}

fatal() {
  echo "FATAL: $*" >&2
  [ -n "$APP_LOG" ] && echo "FATAL: $*" >>"$APP_LOG"
  exit 1
}

# 脚本自己的提示行也写进同一份日志（保持同一条时间线）。
# 说明：日志文件里，entrypoint 阶段是**原始文本**（第三方命令的输出本来就多行文本，
# 没法假装成 JSON），应用启动之后才是 JSON Lines。前者只在文件顶部出现几行，
# 不影响 `grep '"level":"error"'`；要整文件解析可以用 `jq -R 'fromjson? // {level:"raw",msg:.}'`。
say() {
  printf '%s\n' "$*"
  [ -n "$APP_LOG" ] && printf '%s\n' "$*" >>"$APP_LOG"
  return 0
}

# 用仓库内的 prisma 二进制，**不用 npx**。
#
# npx 的行为是：本地 node_modules/.bin 里找不到就**去 registry 下载**。
# 也就是说，一旦 prisma CLI 因为任何原因不在镜像里（例如又被挪回 devDependencies、
# 或 npm prune 把它删掉），npx 不会立刻报错，而是挂在那里尝试联网 —— 
# 在一个启动路径上，这等于「容器卡死不提供服务」，而不是「快速失败」。
# 直接调用本地路径，缺失时立刻以非零码退出，失败模式是明确且立即可见的。
PRISMA_BIN=./node_modules/.bin/prisma

if [ ! -x "$PRISMA_BIN" ]; then
  fatal "$PRISMA_BIN 不存在。prisma CLI 必须位于 dependencies（而非 devDependencies）中，
       否则镜像构建的 npm prune --omit=dev 会把它删除。"
fi

say "Running database migration..."
run_logged "$PRISMA_BIN" migrate deploy

say "Seeding initial data..."
run_logged node seed.js

say "Starting server..."
# 应用进程本身**不做 tee**：`exec` 保持 node 为 PID 1，docker stop 的 SIGTERM
# 才能直达 node（Nest 的优雅关闭依赖它）；而应用日志已由 AppFileLogger 自己落盘。
exec node dist/src/main
