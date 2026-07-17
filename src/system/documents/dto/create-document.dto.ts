import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
    ArrayNotEmpty,
    ArrayUnique,
    IsArray,
    IsDateString,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator'

export class CreateDocumentDto {
    @ApiProperty({ type: String, isArray: true, example: ['gia-9.normative-documents'] })
    @IsArray()
    @ArrayNotEmpty()
    @ArrayUnique()
    @IsString({ each: true })
    @IsNotEmpty({ each: true })
    @MaxLength(160, { each: true })
    @Transform(({ value }) => {
        if (Array.isArray(value)) return value
        if (typeof value !== 'string') return value
        try {
            const parsed = JSON.parse(value)
            return Array.isArray(parsed) ? parsed : [value]
        } catch {
            return [value]
        }
    })
    placementKeys!: string[]

    @ApiProperty({ example: 'Порядок проведения ГИА-9' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    title!: string

    @ApiPropertyOptional({ example: 'Актуальная редакция документа' })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    description?: string

    @ApiPropertyOptional({ example: 'Приказ № 123' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    documentNumber?: string

    @ApiPropertyOptional({ example: '2026-07-12' })
    @IsOptional()
    @IsDateString()
    documentDate?: string
}
