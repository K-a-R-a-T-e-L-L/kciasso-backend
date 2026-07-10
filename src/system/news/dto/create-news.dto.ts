import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsDate, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateNewsDto {
    @ApiProperty()
    @IsString()
    @MinLength(3)
    @MaxLength(255)
    title: string

    @ApiProperty()
    @IsString()
    @MinLength(3)
    @MaxLength(255)
    slug: string

    @ApiProperty()
    @IsString()
    @MinLength(3)
    excerpt: string

    @ApiProperty()
    @IsString()
    @MinLength(3)
    content: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    coverImageUrl?: string

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
}
