import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { DocumentStatus } from '@prisma/client'
import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator'

export class DocumentQueryDto {
    @ApiProperty({ example: 'gia-9.normative-documents' })
    @IsString()
    @IsNotEmpty()
    placementKey!: string

    @ApiPropertyOptional({ enum: DocumentStatus })
    @IsOptional()
    @IsEnum(DocumentStatus)
    status?: DocumentStatus

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page = 1

    @ApiPropertyOptional({ default: 20, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit = 20
}
