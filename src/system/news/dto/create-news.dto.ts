import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsDate, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateNewsDto {
    @ApiProperty()
    @IsString()
    @MinLength(3)
    @MaxLength(255)
    title: string

    @ApiPropertyOptional({ description: 'Оставьте пустым для автоматической генерации из заголовка' })
    @Transform(({ value }) => (typeof value === 'string' && !value.trim() ? undefined : value))
    @IsOptional()
    @IsString()
    @MinLength(3)
    @MaxLength(255)
    slug?: string

    @ApiProperty()
    @IsString()
    @MinLength(3)
    excerpt: string

    @ApiProperty()
    @IsString()
    @MinLength(3)
    content: string

    @ApiPropertyOptional({ nullable: true })
    @IsOptional()
    @IsString()
    coverImageUrl?: string | null

    @ApiPropertyOptional()
    @Type(() => Number)
    @IsOptional()
    @IsInt()
    categoryId?: number

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isPublished?: boolean

    @ApiPropertyOptional()
    @Type(() => Date)
    @IsOptional()
    @IsDate()
    publishedAt?: Date

    @ApiPropertyOptional()
    @Type(() => Date)
    @IsOptional()
    @IsDate()
    publishUntil?: Date

    @ApiPropertyOptional()
    @Type(() => Date)
    @IsOptional()
    @IsDate()
    displayPublishedAt?: Date
}
