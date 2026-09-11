import { appendFileSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ConsoleLogger } from '@nestjs/common'
import type { LoggerService } from '@nestjs/common'

/**
 * 应用日志落盘（2026-09-11）
 *
 * ── 为什么需要它 ──
 * `docker logs` 读的是**当前容器**的 json-file 日志，而 `docker compose up -d`
 * （也就是每次发布）都会换一个新容器 —— 旧容器的日志文件随之被删除。
 * 2026-09-11 两次 502 的现场、「查不清是谁删的图片」的归因困难，都是这个原因：
 * 事后只剩访问日志，应用侧的错误与堆栈一条都拿不到。
 *
 * ── 为什么不是「配一下 Docker logging driver」 ──
 * `json-file` + `max-size`/`max-file` 只解决「单个容器的日志无限增长」，
 * 不解决「容器换了就查不到上一个容器」：日志文件始终在
 * /var/lib/docker/containers/<id>/ 下，容器一删就没了。
 * 要跨越容器生命周期，日志必须写进**卷 / bind mount** 里的文件。
 *
 * ── 为什么自己做滚动而不是 logrotate ──
 * 容器里没有 cron；而 logrotate 面对「进程长期持有 fd 的追加写入」需要
 * copytruncate 之类的妥协。进程内按大小滚动是最简单且零依赖的做法：
 * 写之前比一下字节数，超限就把 app.log 改名成 app.log.1 再依次顺延，最旧的删掉。
 *
 * ── 为什么用 appendFileSync（同步）而不是写流 ──
 * 最需要日志的场合恰恰是**进程崩溃**，而写流会把最后若干行留在用户态缓冲区里
 * 一起丢掉。同步追加每行几十微秒，而同一个请求里的 bcrypt 是 ~250ms，
 * 差 3~4 个数量级 —— 不值得为这点开销冒丢日志的风险。
 *
 * ── 为什么要接管 console ──
 * Nest 的 Logger 走 LoggerService（本类实现），但代码里还有直接调 console.* 的地方
 * （main.ts 的启动日志与生产环境致命校验、MinIO 代理错误），它们永远不经过
 * LoggerService。所以 console 也要 tee 一份。
 * 两条路径**不会重复记录**：本类给 stdout 的输出用的是自带的 ConsoleLogger，
 * 而 ConsoleLogger 直接写 process.stdout/stderr，不经过 console。
 *
 * ── 失败时的行为 ──
 * 记日志失败绝不能把应用带崩：所有 fs 操作都包在 try/catch 里，
 * 连续失败若干次后自动停用文件输出并说明原因（stderr 一次），此后只剩 stdout。
 */

/** 单个文件的上限，默认 10 MiB */
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024
/** 保留的文件总数（含正在写的 app.log），默认 5 个 —— 即 1 个当前 + 4 个历史 */
const DEFAULT_KEEP_FILES = 5
/** 连续失败多少次后停用文件输出 */
const MAX_CONSECUTIVE_FAILURES = 3

export interface AppFileLoggerOptions {
  /** 日志目录；为 null 表示完全关闭文件输出 */
  dir: string | null
  /** 文件名（不含目录） */
  file: string
  maxBytes: number
  keepFiles: number
}

/**
 * 从环境变量解析配置。
 *
 * `LOG_DIR` 的三种取值：
 *   - 未设置        → `<cwd>/logs`（本地开发也能直接看到日志文件）
 *   - `off` 或 `''` → 关闭文件输出，只留 stdout（自动化测试用得上）
 *   - 路径          → 用该目录（生产由 compose 传 `/app/logs`）
 */
export function resolveLoggerOptions(env: NodeJS.ProcessEnv = process.env): AppFileLoggerOptions {
  const rawDir = env.LOG_DIR
  const dir =
    rawDir === undefined
      ? join(process.cwd(), 'logs')
      : rawDir.trim().toLowerCase() === 'off' || rawDir.trim() === ''
        ? null
        : rawDir.trim()

  const maxBytes = toPositiveInt(env.LOG_MAX_BYTES, DEFAULT_MAX_BYTES)
  // 至少 2 个文件才有「滚动」可言，否则历史的唯一一份会被立刻删掉
  const keepFiles = Math.max(2, toPositiveInt(env.LOG_MAX_FILES, DEFAULT_KEEP_FILES))

  return { dir, file: env.LOG_FILE?.trim() || 'app.log', maxBytes, keepFiles }
}

function toPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  // 上限 1 MiB 是防止误配成 100 字节导致每行都触发一次滚动
  return Number.isFinite(n) && n >= 1024 ? n : fallback
}

/** 把任意值转成可放进一行 JSON 的文本（对象序列化失败时退回 String） */
function toText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/** Nest 把堆栈当作「含 at 帧的多行字符串」传递，据此把它与普通消息区分开 */
function isStackTrace(value: string): boolean {
  return /\n\s+at\s/.test(value) || (value.startsWith('Error') && value.includes('\n'))
}

/**
 * 拆分 Nest 的 LoggerService 调用参数。
 *
 * Nest 的 `Logger` 类会把 context **追加为最后一个可选参数**（见
 * `@nestjs/common/services/logger.service.js`），`error()` 在只有 context
 * 的情况下还会先塞一个 `undefined` 占位。所以这里：
 *   1. 末尾的字符串若不是堆栈 → 当作 context；
 *   2. 其余参数里第一个像堆栈的 → 当作 stack；
 *   3. 剩下的一律拼进正文（并过滤掉 undefined/null 占位）。
 */
export function splitNestArgs(
  message: unknown,
  params: unknown[],
): { msg: string; stack?: string; ctx?: string } {
  const rest = [...params]
  let ctx: string | undefined

  if (rest.length > 0) {
    const last = rest[rest.length - 1]
    if (typeof last === 'string' && !isStackTrace(last)) ctx = rest.pop() as string
  }

  const stackIdx = rest.findIndex((p) => typeof p === 'string' && isStackTrace(p))
  let stack: string | undefined
  if (stackIdx >= 0) stack = toText(rest.splice(stackIdx, 1)[0])

  const parts = [message, ...rest].filter((p) => p !== undefined && p !== null).map(toText)
  const msg = parts.join(' ')
  return stack ? { msg, stack, ctx } : { msg, ctx }
}

export class AppFileLogger implements LoggerService {
  private readonly opts: AppFileLoggerOptions
  private readonly path: string | null
  /** 当前 app.log 的字节数（内存计数，避免每行都 stat 一次） */
  private bytes = 0
  private consecutiveFailures = 0
  private disabled = false
  private teeInstalled = false
  /** stdout 输出交给 Nest 自带的 ConsoleLogger，保证与改造前的格式完全一致 */
  private readonly stdout = new ConsoleLogger()
  private readonly original: Record<string, (...args: unknown[]) => void>

  constructor(opts: AppFileLoggerOptions = resolveLoggerOptions()) {
    this.opts = opts
    this.path = opts.dir ? join(opts.dir, opts.file) : null

    // 先留好「原始 console」的引用：无论是否接管 console，stdout 输出都要走它，
    // 这样即使 console 被替换过（例如被别的工具包过一层），也不会递归。
    const c = console as unknown as Record<string, (...args: unknown[]) => void>
    this.original = {
      log: c.log.bind(console),
      info: c.info.bind(console),
      warn: c.warn.bind(console),
      error: c.error.bind(console),
      debug: c.debug.bind(console),
      trace: c.trace.bind(console),
    }

    if (!this.path) {
      this.disabled = true
      return
    }

    try {
      mkdirSync(opts.dir as string, { recursive: true })
      // 接续已有文件的大小，否则重启后计数从 0 开始，文件会超出上限一倍
      this.bytes = statSync(this.path).size
    } catch {
      // 文件还不存在（首次启动）——这是正常路径，不是错误
      this.bytes = 0
    }
  }

  // ───────────────────────── LoggerService ─────────────────────────

  log(message: unknown, ...params: unknown[]) {
    this.fromNest('log', message, params)
  }

  error(message: unknown, ...params: unknown[]) {
    this.fromNest('error', message, params)
  }

  warn(message: unknown, ...params: unknown[]) {
    this.fromNest('warn', message, params)
  }

  debug(message: unknown, ...params: unknown[]) {
    this.fromNest('debug', message, params)
  }

  verbose(message: unknown, ...params: unknown[]) {
    this.fromNest('verbose', message, params)
  }

  fatal(message: unknown, ...params: unknown[]) {
    this.fromNest('fatal', message, params)
  }

  // ───────────────────────── 对外的小工具 ─────────────────────────

  /** 生效配置的可读描述，用于启动日志 */
  describe(): string {
    if (!this.path) return '已关闭（LOG_DIR=off），仅输出到 stdout'
    const mib = (n: number) => (n / 1024 / 1024).toFixed(1)
    return `${this.path}（${mib(this.opts.maxBytes)} MiB × ${this.opts.keepFiles} 个文件，上限约 ${mib(this.opts.maxBytes * this.opts.keepFiles)} MiB）`
  }

  /** 供测试断言用 */
  get filePath(): string | null {
    return this.path
  }

  /**
   * 让直接调用 `console.*` 的地方也落盘。
   *
   * 必须尽早调用（在 NestFactory.create 之前）：生产环境的 JWT 校验失败会
   * `process.exit(1)`，那正是最需要留下证据的一刻。
   */
  installConsoleTee(): void {
    if (this.teeInstalled || !this.path) return
    this.teeInstalled = true

    const c = console as unknown as Record<string, (...args: unknown[]) => void>
    const patch = (name: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace') => {
      const orig = this.original[name]
      c[name] = (...args: unknown[]) => {
        this.writeConsole(name, args)
        orig(...args)
      }
    }
    ;(['log', 'info', 'warn', 'error', 'debug', 'trace'] as const).forEach(patch)
  }

  // ───────────────────────── 内部实现 ─────────────────────────

  private fromNest(level: string, message: unknown, params: unknown[]): void {
    const { msg, stack, ctx } = splitNestArgs(message, params)
    this.write(level, msg, stack, ctx)
    // stdout 原样交给 ConsoleLogger：改造前后 `docker logs` 的内容不变，
    // 只是多了一份落盘副本。
    const sink = level === 'verbose' ? 'debug' : level === 'fatal' ? 'error' : level
    ;(this.stdout as unknown as Record<string, (...a: unknown[]) => void>)[sink]?.(message, ...params)
  }

  private writeConsole(level: string, args: unknown[]): void {
    // console 的调用没有「context」概念，所以这里不做 Nest 那套参数拆分，
    // 避免把 `console.error('MinIO proxy error:', 'xxx')` 里的 'xxx' 误判成 context。
    const errIdx = args.findIndex((a) => a instanceof Error)
    let stack: string | undefined
    const parts = [...args]
    if (errIdx >= 0) stack = toText(parts.splice(errIdx, 1)[0])
    this.write(level, parts.map(toText).join(' '), stack)
  }

  private write(level: string, msg: string, stack?: string, ctx?: string): void {
    if (this.disabled || !this.path) return

    // 一行一个 JSON 对象（JSON Lines）：换行被转义，所以「一条日志 = 一行」，
    // grep/jq 都能直接用，和 Caddy 的访问日志风格保持一致。
    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      pid: process.pid,
    }
    if (ctx) entry.ctx = ctx
    entry.msg = msg
    if (stack) entry.stack = stack
    const line = `${JSON.stringify(entry)}\n`
    const size = Buffer.byteLength(line, 'utf8')

    try {
      if (this.bytes > 0 && this.bytes + size > this.opts.maxBytes) this.rotate()
      appendFileSync(this.path, line)
      this.bytes += size
      this.consecutiveFailures = 0
    } catch (err) {
      this.handleFailure(err)
    }
  }

  /** app.log → app.log.1 → app.log.2 …… 最旧的一份删掉 */
  private rotate(): void {
    const path = this.path as string
    const keep = this.opts.keepFiles
    // keep 含当前文件，所以历史份数是 keep-1
    rmSync(`${path}.${keep - 1}`, { force: true })
    for (let i = keep - 2; i >= 1; i--) {
      // 源文件可能不存在（刚启动、历史份数还没攒够），忽略即可
      try {
        renameSync(`${path}.${i}`, `${path}.${i + 1}`)
      } catch {
        /* ENOENT：该份历史还不存在 */
      }
    }
    try {
      renameSync(path, `${path}.1`)
    } catch {
      /* ENOENT：当前文件还不存在（理论上不会走到这里） */
    }
    this.bytes = 0
  }

  private handleFailure(err: unknown): void {
    this.consecutiveFailures += 1
    if (this.consecutiveFailures <= MAX_CONSECUTIVE_FAILURES) {
      const why = err instanceof Error ? err.message : String(err)
      this.original.error(
        `[AppFileLogger] 写日志失败（第 ${this.consecutiveFailures} 次）：${why} —— 目标 ${this.path}`,
      )
    }
    if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && !this.disabled) {
      this.disabled = true
      this.original.error(
        `[AppFileLogger] 连续 ${MAX_CONSECUTIVE_FAILURES} 次写日志失败，已停用文件输出；` +
          '应用继续运行，但只剩 stdout（日志不再跨容器留存）。',
      )
    }
  }
}
