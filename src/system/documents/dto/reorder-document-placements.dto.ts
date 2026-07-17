import { ApiProperty } from '@nestjs/swagger'
import { ArrayNotEmpty, ArrayUnique, IsArray, IsInt, IsString, MaxLength } from 'class-validator'

export class ReorderDocumentPlacementsDto {
    @ApiProperty({ example: 'gia-11.normative-documents' })
    @IsString()
    @MaxLength(160)
    sectionKey!: string

    @ApiProperty({ type: Number, isArray: true })
    @IsArray()
    @ArrayNotEmpty()
    @ArrayUnique()
    @IsInt({ each: true })
    orderedDocumentIds!: number[]
}
