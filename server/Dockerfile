# ── 阶段 0：apt 源与超时调优（阶段 1 与运行阶段共用）──
#
# 为什么必须调优 —— 这是 2026-09-11 发布事故的第二层原因，靠 stale layer cache 掩盖了很久：
# 默认源 deb.debian.org 在 BuildKit 构建容器里下载大索引会长时间卡住
# （实测 8.7MB 的 Packages 索引 84 秒毫无进展，小文件却 1~5 秒就完成；
#   真实构建因此累计挂了 10 分钟以上）。换成阿里云镜像后
# `apt-get update` + `apt-get install` 合计 **51.8 秒**（实测）。
#   - ForceIPv4：容器内若没有 IPv6 路由，避免先干等 AAAA 超时
#   - 显式超时：保证最坏结果是「构建失败」，而不是「无限期挂住」
#
# 注意：运行阶段也继承这里的源配置（它需要 apt 装 openssl）。只影响容器内手动
# 执行 apt 的行为，不影响应用运行。
FROM node:20-slim AS apt-tuned
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
 && printf 'Acquire::ForceIPv4 "true";\nAcquire::Retries "2";\nAcquire::http::Timeout "20";\n' \
      > /etc/apt/apt.conf.d/99-build-tuning

# ── 阶段 1：构建服务端 ──
FROM apt-tuned AS server-builder
WORKDIR /app

# 给构建进程一个堆上限。
# 目的不是省内存，而是把失控时的失败模式从「把整机拖死、站点不可访问」
# 换成「构建报错失败」—— 旧容器仍在服务，重跑即可。
# 实测本项目各步骤的 RSS：nest build ~155MB、vite build ~200MB、npm ci 更低，
# 512MB 有充足余量。
ENV NODE_OPTIONS=--max-old-space-size=512

# python3/make/g++ 是**必需**的，不是可选优化：bcrypt 的预编译包在本网络下载会失败
# （实测 `node-pre-gyp ERR! not ok`），于是回落到源码编译；没有工具链时
# `npm ci` 会直接以 exit 1 失败（实测验证过）。
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./
RUN npm ci
COPY server/ .
RUN ./node_modules/.bin/prisma generate
RUN npm run build

# ── 丢掉 devDependencies ──
# `npm ci` 装的是「完整依赖」，里面包含 @nestjs/cli、typescript、jest、ts-jest、
# ts-loader、webpack、@angular-devkit 等一大堆只在构建期有用、运行期完全用不到的东西。
# 生产机上实测：顶层包 518 个，其中**只有 239 个**属于运行期依赖树，
# devDependencies 占了 279 个（typescript 23MB、@angular-devkit 25MB、@babel 12MB、
# webpack 9MB、caniuse-lite 5MB、terser 3MB……）。
#
# `npm prune --omit=dev` 是**离线**操作：它只按 package.json/lock 修剪已装好的树，
# 不重新下载任何东西。所以这一点减重不花构建时间 —— 这点很重要，因为本项目的
# 构建耗时 88% 都花在装依赖的网络等待上（见 docs/）。
#
# 之所以不另起一个 `npm ci --omit=dev` 阶段：那会多一次完整下载（冷构建 +150 秒），
# 而且会与 client-builder 的 npm ci 并发挤占只有 1.6GB 内存的生产机。
#
# ⚠️ 前置条件：`prisma` CLI 必须已在 dependencies 里（已从 devDependencies 移过来）。
# 它被 entrypoint.sh 的 `prisma migrate deploy` 用到；若仍是 devDependency，
# prune 会把它删掉，容器启动就会失败。
RUN npm prune --omit=dev

# prune 之后再生成一次 Prisma Client。这不是多余动作：
# node_modules/.prisma/ 是 generate 生成的**非包目录**，npm prune 对它的处置
# 属于实现细节而非契约，重新生成可以不管 prune 怎么处理它都得到正确结果。
# 代价约 3 秒（实测），换掉一个「升级 npm 后容器起不来」的隐患，很划算。
# 上面的 prune 保留了 prisma CLI，所以这一步不需要网络。
RUN ./node_modules/.bin/prisma generate

# ── 阶段 2：构建客户端 ──
FROM apt-tuned AS client-builder
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
# 与构建阶段共用 apt-tuned 的源配置，否则这一步的 apt 会挂在 deb.debian.org 上。
FROM apt-tuned
WORKDIR /app

# Prisma 引擎需要 OpenSSL。
# 实测 node:20-slim **不含** libssl.so.3 / libcrypto.so.3（dpkg 里也没有 libssl），
# 所以这一步不能省。上面几行已解释为什么需要 --no-install-recommends 与镜像源调优。
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

# 服务端产物
# 注意 node_modules 来自上面**已 prune 过**的 server-builder（`npm prune --omit=dev`），
# 不含 @nestjs/cli / typescript / jest 等构建期依赖。
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

# 运行期依赖自检：把「prune 删多了」的失败现场从「容器起不来」提前到「构建失败」。
# 放在运行阶段、在 COPY 之后，检验的正是最终真正发出去的那棵树。
# 详见 server/scripts/check-runtime-deps.js 顶部的说明。
RUN node scripts/check-runtime-deps.js

RUN mkdir -p /app/data
RUN chmod +x entrypoint.sh

EXPOSE 3000

# 健康检查。
#
# 只能用 node 的 fetch，不能用 curl/wget：node:20-slim 里**没有 wget**
# （2026-09-11 排查构建问题时，我用 wget 探测镜像源可达性，四个源全部 FAIL，
#   差点得出「容器没有外网」的错误结论 —— 真实原因是根本没有 wget）。
# Node 20 自带全局 fetch，零依赖。
#
# 说清楚它**不做什么**：compose 里的 `restart: unless-stopped` 不会因为
# unhealthy 而重启容器（那需要 swarm 模式或 autoheal 之类的看门狗）。
# 所以这个健康检查的价值是**可观测性**：`docker ps` 直接显示 health 状态，
# 发布后不必再手动 curl 才能确认服务真的起来了。
#
# start-period 给 60 秒：entrypoint 在启动服务前要先跑
# `prisma migrate deploy` + `seed.js`，冷数据卷上这两步不是瞬间完成的。
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["./entrypoint.sh"]

