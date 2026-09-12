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

// 密码哈希强度（待办 #8，2026-09-12：cost 12 → 11）。
// 本机实测 hash/compare：12 ≈ 203ms，11 ≈ 104ms（约 1.96 倍提速，仍高于 OWASP
// 基准下限 10）。bcrypt 的 cost 是**每个哈希自带**的字段：降档只影响之后新建的
// 哈希（注册 / 种子脚本），存量用户登录时 compare 仍按自己哈希里的 cost 跑，
// 直到改密。注意 login 里防时序枚举的假哈希（LOGIN_DECOY_HASH）必须与真实 cost
// 同步 —— 否则「用户不存在 (cost 12) vs 已注册 (cost 11)」的耗时差会把
//「这个邮箱有没有注册」泄露出去。
const BCRYPT_COST = 11
const LOGIN_DECOY_HASH = '$2b$11$66KPuolmfVeW3c4Ya8Bl7eruyJ0YzRgwEkFtQ1zbW.AqZgT1wG7ry'

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

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST)
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
    const hash = user?.passwordHash || LOGIN_DECOY_HASH
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
