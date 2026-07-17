import { ApiProperty } from '@nestjs/swagger'

export class DocumentVersionDto {
    @ApiProperty() id!: number
    @ApiProperty() versionNumber!: number
    @ApiProperty() originalFilename!: string
    @ApiProperty() extension!: string
    @ApiProperty() mimeType!: string
    @ApiProperty({ type: String, format: 'int64' }) sizeBytes!: string
    @ApiProperty({ minLength: 64, maxLength: 64 }) sha256!: string
    @ApiProperty() createdAt!: Date
    @ApiProperty() isCurrent!: boolean
}
