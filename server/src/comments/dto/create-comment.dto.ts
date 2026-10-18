import { IsString, Length } from 'class-validator'

export class CreateCommentDto {
  @IsString()
  @Length(1, 500, { message: '评论内容需在 1~500 字之间' })
  content!: string
}
