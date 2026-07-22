import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { DocumentStatus, PublicationStatus } from '@prisma/client'

import { DocumentVersionDto } from './document-version.dto'

export class DocumentPlacementDto {
    @ApiProperty() id!: number
    @ApiProperty() sectionKey!: string
    @ApiProperty() sortOrder!: number
    @ApiProperty({ enum: PublicationStatus }) publicationStatus!: PublicationStatus
    @ApiPropertyOptional() publishFrom!: Date | null
    @ApiPropertyOptional() publishUntil!: Date | null
    @ApiPropertyOptional() displayPublishedAt!: Date | null
    @ApiProperty() publicationRevision!: number
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
    @ApiProperty() canManage!: boolean
    @ApiProperty() createdAt!: Date
    @ApiProperty() updatedAt!: Date
}
