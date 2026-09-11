import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { Request } from 'express'

/**
 * 全局异常过滤器。
 *
 * 除了统一响应格式，这里还负责把「框架/ORM 抛出的、信息量为零的异常」
 * 翻译成有意义的状态码与可读消息，并把 5xx 记录下来 ——
 * 之前这个过滤器不写任何日志，Prisma 的 SQLITE_BUSY / P2025 / P2003
 * 全都会被压成一个无从排查的 500。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter')

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse()
    const request = ctx.getRequest<Request>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = '服务器内部错误'

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const res = exception.getResponse()
      message = typeof res === 'string' ? res : (res as any).message || exception.message

      if (Array.isArray(message)) {
        // ValidationPipe 的 message 是字符串数组，拼起来即可
        message = message.join('; ')
      }
    } else {
      // 非 HttpException：识别 Prisma 错误码，给出比 500 更准确的语义
      const mapped = this.mapPrismaError(exception)
      if (mapped) {
        status = mapped.status
        message = mapped.message
      }
    }

    // 只有 5xx 记完整堆栈：4xx 是正常的客户端错误（比如验证码错、图片不存在），
    // 记成 error 会把日志淹掉，反而让真正的故障看不见。
    if (status >= 500) {
      this.logger.error(
        `${request?.method ?? '-'} ${request?.originalUrl ?? '-'} -> ${status} ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    }

    // 注意：响应头可能已经开始发送（例如流式接口中途出错），此时再写会抛 ERR_HTTP_HEADERS_SENT
    if (response.headersSent) {
      response.end()
      return
    }

    response.status(status).json({
      code: status,
      message,
      data: null,
    })
  }

  /** Prisma 已知错误码 → HTTP 语义。未识别的返回 null，仍走 500。 */
  private mapPrismaError(exception: unknown): { status: number; message: string } | null {
    const code = (exception as { code?: unknown })?.code
    if (typeof code !== 'string') return null

    switch (code) {
      // 记录不存在（update/delete 的目标被并发删掉了）
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, message: '记录不存在或已被删除' }
      // 外键约束失败（例如给不存在的分类关联图片）
      case 'P2003':
        return { status: HttpStatus.CONFLICT, message: '关联数据不存在' }
      // 唯一约束冲突（并发写入同一 email/username）
      case 'P2002':
        return { status: HttpStatus.CONFLICT, message: '数据已存在' }
      // SQLite 写锁超时：WAL 模式下读写不互斥，但仍可能出现写-写竞争，
      // 属于「稍后重试就能成功」的瞬时故障，用 503 + Retry-After 语义表达
      case 'P2034':
        return { status: HttpStatus.SERVICE_UNAVAILABLE, message: '数据库繁忙，请稍后重试' }
      default:
        return null
    }
  }
}
