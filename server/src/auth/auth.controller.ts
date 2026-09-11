import { Controller, Post, Get, Body } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { AuthService } from './auth.service'
import { Public } from '../common/decorators/public.decorator'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'

// 全局配额是 600/分钟（按接口 × IP 计数，见 app.module.ts），对读接口合适，
// 但对下面的写接口太松：
//  - login/register 会跑 bcrypt（cost 12，单次约 250-350ms CPU），是唯一能被用来
//    打满 CPU 的公开接口；
//  - register 还带验证码，本质是防脚本，配额给太松就没意义。
// 因此这里用 @Throttle 覆盖 default 这一档的数值（名字不传时 guard 内部就叫 default）。

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Get('captcha')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async getCaptcha() {
    return this.authService.generateCaptcha()
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken)
  }
}
