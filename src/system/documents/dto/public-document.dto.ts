import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class PublicDocumentVersionDto {
    @ApiProperty() originalFilename!: string
    @ApiProperty() extension!: string
    @ApiProperty() mimeType!: string
    @ApiProperty() sizeBytes!: string
}

export class PublicDocumentDto {
    @ApiProperty() id!: number
    @ApiProperty() title!: string
    @ApiPropertyOptional() description!: string | null
    @ApiPropertyOptional() documentNumber!: string | null
    @ApiPropertyOptional() documentDate!: Date | null
    @ApiProperty() updatedAt!: Date
    @ApiProperty({ type: () => PublicDocumentVersionDto }) currentVersion!: PublicDocumentVersionDto
}
