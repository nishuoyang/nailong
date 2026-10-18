import { IsBoolean, IsOptional, IsString, Length } from 'class-validator'

export class CreateCollectionDto {
  @IsString()
  @Length(1, 40, { message: '收藏夹名称需在 1~40 字之间' })
  name!: string

  @IsOptional()
  @IsString()
  @Length(0, 200, { message: '简介不能超过 200 字' })
  description?: string

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean
}

export class UpdateCollectionDto {
  @IsOptional()
  @IsString()
  @Length(1, 40, { message: '收藏夹名称需在 1~40 字之间' })
  name?: string

  @IsOptional()
  @IsString()
  @Length(0, 200, { message: '简介不能超过 200 字' })
  description?: string

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean
}

export class AddCollectionImageDto {
  @IsString()
  imageId!: string
}
