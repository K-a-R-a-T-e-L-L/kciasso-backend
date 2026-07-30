import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
export class AffectedPageRevisionDto {
    @ApiProperty() pageKey: string
    @ApiProperty() revision: number
}
export class GlobalHtmlSectionResponseDto {
    @ApiProperty() definitionId: number
    @ApiProperty({ nullable: true }) key: string | null
    @ApiProperty() name: string
    @ApiProperty() revision: number
    @ApiProperty({ nullable: true }) iframeHeight: number | null
    @ApiProperty() visiblePlacements: number
    @ApiProperty() hiddenPlacements: number
    @ApiProperty() totalPlacements: number
    @ApiPropertyOptional() html?: string
    @ApiPropertyOptional() css?: string
    @ApiPropertyOptional() javascript?: string
}
export class CreateGlobalHtmlSectionResponseDto {
    @ApiProperty({ type: GlobalHtmlSectionResponseDto }) globalDefinition: GlobalHtmlSectionResponseDto
    @ApiProperty({ type: [AffectedPageRevisionDto] }) affectedPages: AffectedPageRevisionDto[]
}
export class DeleteGlobalHtmlSectionResponseDto {
    @ApiProperty() definitionId: number
    @ApiProperty({ type: [AffectedPageRevisionDto] }) affectedPages: AffectedPageRevisionDto[]
}
