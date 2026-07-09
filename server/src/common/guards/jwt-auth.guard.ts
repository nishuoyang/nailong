import { Injectable, ExecutionContext } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
  ) {
    super()
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      // 公开端点：手动尝试解析 JWT，不通过 Passport（避免异步回调时序问题）
      const request = context.switchToHttp().getRequest()
      const authHeader = request.headers.authorization
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const token = authHeader.slice(7)
          const payload = this.jwtService.verify(token)
          request.user = {
            id: payload.sub,
            email: payload.email,
            username: payload.username,
            role: payload.role,
          }
        } catch {
          // token 无效 — 公开端点允许通过
        }
      }
      return true
    }

    // 非公开端点：必须走完整 Passport 流程，token 无效则返回 401
    return super.canActivate(context) as Promise<boolean>
  }
}
