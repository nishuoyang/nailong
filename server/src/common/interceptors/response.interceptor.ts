import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface WrappedResponse<T> {
  code: number
  message: string
  data: T
  meta?: Record<string, unknown>
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, WrappedResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<WrappedResponse<T>> {
    return next.handle().pipe(
      map((result) => {
        // 已经是标准格式则直接返回
        if (result && typeof result === 'object' && 'code' in result) {
          return result
        }

        // 服务层返回 { data, meta } 分页格式 → 提升 meta 到顶层
        if (result && typeof result === 'object' && 'data' in result && 'meta' in result) {
          return {
            code: 0,
            message: 'ok',
            data: result.data,
            meta: result.meta,
          }
        }

        // 普通数据直接包装
        return { code: 0, message: 'ok', data: result }
      }),
    )
  }
}
