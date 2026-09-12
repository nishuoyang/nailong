# 发布 overlay：把本地构建的产物盖进现有运行镜像，不重装依赖。
#
# 动机（待办 #3「构建搬到本地/CI」）：生产机上每次 `docker compose build server`
# 约 85 秒，期间全站请求延迟明显抬升（实测平均 87→289 ms、峰值 5056 ms）。
# 本项目真正的编译只占十几秒，88% 是装依赖的网络时间 —— 依赖没变时根本不该在
# 生产机上重新下载。
#
# 用法：
#   1. 本地构建产物并打包（docs/build-release.ps1，只在本地、不入库），产物结构
#      与镜像 /app 对应：dist/ client-dist/ prisma/ seed.js entrypoint.sh scripts/；
#      package*.json 也会打包进去，但只作 guard 输入。
#   2. ecs_upload 到服务器 /root/releases/<sha>.tar.gz，解压到 /root/releases/<sha>/。
#   3. 服务器执行 deploy/release.sh <sha>（见该文件）。
#
# ⚠️ 前置条件（release.sh 的 guard 会拦住，这里不重复）：
#   server/package*.json 与 server/prisma/schema.prisma 必须与基础镜像一致。
#   依赖或 schema 变化必须走完整构建 —— node_modules 与 Prisma Client 含
#   对应平台的**原生二进制**，overlay 无法替换它们（本地构建出来的是 win32/darwin 引擎）。
#
# 构建上下文 = 上传的 release 目录（上下文里多出的 package*.json 不会被 COPY）。
FROM nailonghub-server:latest

COPY dist /app/dist
COPY client-dist /app/client-dist
COPY prisma /app/prisma
COPY seed.js /app/seed.js
COPY entrypoint.sh /app/entrypoint.sh
COPY scripts /app/scripts

# schema 变更时重新生成 Prisma Client（离线、实测约 1.4 秒）。
#
# overlay 的 node_modules 是在完整构建阶段装好并 `npm prune --omit=dev` 的
# 平台原生二进制，不能重新 npm ci；但 `prisma generate` 只吃 schema + 已装的
# 引擎，不做任何下载，所以 **schema-only 变更可以继续走 overlay**，不必退回
# 85 秒的完整构建。配合 release.sh：schema.prisma 不一致时警告放行
# （package*.json 不一致仍 FATAL，见 release.sh guard）。
#
# 每次发布都跑一遍（不只是 schema 变更时）：无 schema 变更时输出与旧客户端一致，
# 代价 1~2 秒，换来「guard 判据与镜像内容强一致」的确定性。
RUN ./node_modules/.bin/prisma generate

# entrypoint 与完整构建一样要保持可执行；再跑一次运行期依赖自检
# （对着 overlay 之后真正合出来的那棵树，坏在构建期而不是容器起不来）。
RUN chmod +x /app/entrypoint.sh \
 && node /app/scripts/check-runtime-deps.js