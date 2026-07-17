import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { DocumentStatus } from '@prisma/client'

import { DocumentVersionDto } from './document-version.dto'

export class DocumentPlacementDto {
    @ApiProperty() id!: number
    @ApiProperty() sectionKey!: string
    @ApiProperty() sortOrder!: number
    @ApiProperty() createdAt!: Date
    @ApiProperty() updatedAt!: Date
}

export class DocumentDto {
    @ApiProperty() id!: number
    @ApiProperty() title!: string
    @ApiPropertyOptional() description!: string | null
    @ApiPropertyOptional() documentNumber!: string | null
    @ApiPropertyOptional() documentDate!: Date | null
    @ApiProperty({ enum: DocumentStatus }) status!: DocumentStatus
    @ApiProperty({ type: () => DocumentPlacementDto, isArray: true }) placements!: DocumentPlacementDto[]
    @ApiPropertyOptional({ type: () => DocumentVersionDto }) currentVersion!: DocumentVersionDto | null
    @ApiProperty() versionsCount!: number
    @ApiProperty() createdAt!: Date
    @ApiProperty() updatedAt!: Date
}
