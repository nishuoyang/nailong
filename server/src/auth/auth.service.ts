import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import * as svgCaptcha from 'svg-captcha'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { SettingsService } from '../settings/settings.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { randomBytes } from 'crypto'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
    private settingsService: SettingsService,
  ) {}

  async generateCaptcha() {
    const captcha = svgCaptcha.create({
      size: 4,
      noise: 2,
      width: 120,
      height: 36,
      color: true,
      background: '#f2f2f2',
    })

    const sessionId = randomBytes(16).toString('hex')
    // 存 Redis，5 分钟过期，不区分大小写。
    // 这里必须检查写入结果：写失败还返回 SVG 的话，用户填对了也永远验证不过，
    // 表现为「验证码错误或已过期」，无从排查。直接明确报服务不可用。
    const stored = await this.redisService.set(`captcha:${sessionId}`, captcha.text.toLowerCase(), 300)
    if (!stored) {
      throw new ServiceUnavailableException('验证码服务暂不可用，请稍后重试')
    }

    return { svg: captcha.data, sessionId }
  }

  async register(dto: RegisterDto) {
    // 检查注册开关。开关存在数据库里（不再只存 Redis）：
    // Redis 被清空或短暂不可用都不会把它变回「开放」，见 SettingsService 的说明。
    if (!(await this.settingsService.isRegistrationOpen())) {
      throw new BadRequestException('网站暂未开放注册')
    }

    // 验证码校验
    const stored = await this.redisService.get(`captcha:${dto.captchaSessionId}`)
    if (!stored || stored !== dto.captchaText.toLowerCase()) {
      throw new BadRequestException('验证码错误或已过期')
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    })
    if (existing) {
      throw new ConflictException('邮箱或用户名已被注册')
    }

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash,
      },
    })

    // 注册成功后删除验证码，防止重复使用
    await this.redisService.del(`captcha:${dto.captchaSessionId}`)

    const tokens = await this.generateTokens(user.id, user.email, user.username, user.role)
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      ...tokens,
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    })
    // 防时序枚举：无论用户是否存在都执行 bcrypt
    const hash = user?.passwordHash || '$2b$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const valid = await bcrypt.compare(dto.password, hash)
    if (!user || !valid) {
      throw new UnauthorizedException('邮箱或密码错误')
    }

    // 登录限制：开启后仅管理员可登录。同样存在数据库里，Redis 挂掉不影响这个判断。
    if ((await this.settingsService.isLoginRestricted()) && user.role !== 'admin') {
      throw new UnauthorizedException('网站暂未开放登录')
    }

    const tokens = await this.generateTokens(user.id, user.email, user.username, user.role)
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      ...tokens,
    }
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'nailong-refresh-secret-dev-only'),
      })
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
      if (!user) {
        throw new UnauthorizedException('用户不存在')
      }
      return this.generateTokens(user.id, user.email, user.username, user.role)
    } catch {
      throw new UnauthorizedException('refresh token 无效或已过期')
    }
  }

  private async generateTokens(userId: string, email: string, username?: string, role?: string) {
    const payload = { sub: userId, email, username, role }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET', 'nailong-jwt-secret-dev-only'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'nailong-refresh-secret-dev-only'),
        expiresIn: '7d',
      }),
    ])

    return { accessToken, refreshToken }
  }
}
