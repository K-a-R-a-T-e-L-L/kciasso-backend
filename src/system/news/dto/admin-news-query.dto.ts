import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class AdminNewsQueryDto {
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

    @ApiPropertyOptional()
    @IsOptional()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true
        if (value === 'false' || value === false) return false
        return value
    })
    @IsBoolean()
    isPublished?: boolean
}
