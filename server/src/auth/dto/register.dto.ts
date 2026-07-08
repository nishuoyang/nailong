import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator'

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  username: string

  @IsEmail()
  email: string

  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password: string

  @IsString()
  captchaSessionId: string

  @IsString()
  captchaText: string
}
