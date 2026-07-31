import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export enum AdminNewsStatusFilter {
    DRAFT = 'draft',
    SCHEDULED = 'scheduled',
    PUBLISHED = 'published',
}

export enum AdminNewsSort {
    NEWEST = 'newest',
    OLDEST = 'oldest',
    TITLE = 'title',
}

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
    @Transform(({ value, obj, key }) => {
        const rawValue = obj && key in obj ? obj[key] : value
        if (rawValue === 'true' || rawValue === true) return true
        if (rawValue === 'false' || rawValue === false) return false
        return rawValue
    })
    @IsBoolean()
    isPublished?: boolean

    @ApiPropertyOptional({ enum: AdminNewsStatusFilter })
    @IsOptional()
    @IsEnum(AdminNewsStatusFilter)
    status?: AdminNewsStatusFilter

    @ApiPropertyOptional({ enum: AdminNewsSort })
    @IsOptional()
    @IsEnum(AdminNewsSort)
    sort?: AdminNewsSort
}
