import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class CreateNewsCategoryDto {
    @ApiPropertyOptional({ description: 'Оставьте пустым для автоматической генерации из названия' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    slug?: string

    @ApiProperty()
    @IsString()
    @MaxLength(255)
    title: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string

    @ApiPropertyOptional({ default: 0 })
    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(0)
    order?: number

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true
}
