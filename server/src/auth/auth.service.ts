import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import * as svgCaptcha from 'svg-captcha'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
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
    // 存 Redis，5 分钟过期，不区分大小写
    await this.redisService.client.set(
      `captcha:${sessionId}`,
      captcha.text.toLowerCase(),
      'EX',
      300,
    )

    return { svg: captcha.data, sessionId }
  }

  async register(dto: RegisterDto) {
    // 验证码校验
    const stored = await this.redisService.client.get(`captcha:${dto.captchaSessionId}`)
    if (!stored || stored !== dto.captchaText.toLowerCase()) {
      throw new BadRequestException('验证码错误或已过期')
    }
    // 验证成功后删除，防止重复使用
    await this.redisService.client.del(`captcha:${dto.captchaSessionId}`)

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

    const tokens = await this.generateTokens(user.id, user.email)
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
    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误')
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) {
      throw new UnauthorizedException('邮箱或密码错误')
    }

    const tokens = await this.generateTokens(user.id, user.email)
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
      return this.generateTokens(user.id, user.email)
    } catch {
      throw new UnauthorizedException('refresh token 无效或已过期')
    }
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email }

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
