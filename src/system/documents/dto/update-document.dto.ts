import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class UpdateDocumentDto {
    @ApiPropertyOptional({ example: 'Обновлённое название' })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    title?: string

    @ApiPropertyOptional({ nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    description?: string | null

    @ApiPropertyOptional({ nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    documentNumber?: string | null

    @ApiPropertyOptional({ nullable: true, example: '2026-07-12' })
    @IsOptional()
    @IsDateString()
    documentDate?: string | null
}
