import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class NewsQueryDto {
    @ApiPropertyOptional({ default: 1 })
    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(1)
    page?: number = 1

    @ApiPropertyOptional({ default: 10 })
    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 10

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    category?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string
}
