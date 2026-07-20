import { ApiPropertyOptional } from '@nestjs/swagger'
import { DocumentGroup, DocumentStatus } from '@prisma/client'
import { Transform, Type } from 'class-transformer'
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export enum DocumentSortBy {
    UPDATED_AT = 'updatedAt',
    CREATED_AT = 'createdAt',
    TITLE = 'title',
    DOCUMENT_DATE = 'documentDate',
    PLACEMENT_ORDER = 'placementOrder',
}

export enum DocumentSortDirection {
    ASC = 'asc',
    DESC = 'desc',
}

const PAGE_SIZES = [20, 50, 100] as const

export class DocumentQueryDto {
    @ApiPropertyOptional({ example: 'gia-9.normative-documents' })
    @IsOptional()
    @IsString()
    placementKey?: string

    @ApiPropertyOptional({ enum: DocumentGroup })
    @IsOptional()
    @IsEnum(DocumentGroup)
    group?: DocumentGroup

    @ApiPropertyOptional({ maxLength: 200 })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    search?: string

    @ApiPropertyOptional({ enum: DocumentStatus })
    @IsOptional()
    @IsEnum(DocumentStatus)
    status?: DocumentStatus

    @ApiPropertyOptional({ enum: DocumentSortBy, default: DocumentSortBy.UPDATED_AT })
    @IsOptional()
    @IsEnum(DocumentSortBy)
    sortBy: DocumentSortBy = DocumentSortBy.UPDATED_AT

    @ApiPropertyOptional({ enum: DocumentSortDirection, default: DocumentSortDirection.DESC })
    @IsOptional()
    @IsEnum(DocumentSortDirection)
    sortDirection: DocumentSortDirection = DocumentSortDirection.DESC

    @ApiPropertyOptional({ type: Number, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page = 1

    @ApiPropertyOptional({ enum: PAGE_SIZES, default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsIn(PAGE_SIZES)
    pageSize = 20

    /** Backward-compatible alias accepted at the HTTP boundary only. */
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number
}
