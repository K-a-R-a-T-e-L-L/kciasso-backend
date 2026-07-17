import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class DocumentShareLinkDto {
    @ApiProperty() id!: number
    @ApiProperty() tokenPrefix!: string
    @ApiPropertyOptional({ nullable: true }) expiresAt!: Date | null
    @ApiPropertyOptional({ nullable: true }) revokedAt!: Date | null
    @ApiProperty() createdAt!: Date
    @ApiPropertyOptional({ nullable: true }) lastAccessAt!: Date | null
    @ApiProperty() accessCount!: number
    @ApiProperty() isActive!: boolean
    @ApiProperty() isExpired!: boolean
    @ApiProperty() versionId!: number
    @ApiProperty() versionNumber!: number
    @ApiProperty() documentId!: number
    @ApiProperty() documentTitle!: string
}
