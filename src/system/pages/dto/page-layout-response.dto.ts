import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { SectionDefinitionType } from '@prisma/client'
export class PageSectionDescriptorDto {
    @ApiProperty() placementId: number
    @ApiProperty() definitionId: number
    @ApiProperty({ enum: SectionDefinitionType }) type: SectionDefinitionType
    @ApiProperty({ nullable: true }) key: string | null
    @ApiProperty() name: string
    @ApiProperty({ nullable: true }) description: string | null
    @ApiProperty({ nullable: true }) systemRendererKey: string | null
    @ApiProperty() sortOrder: number
    @ApiProperty() isVisible: boolean
    @ApiProperty() isGlobal: boolean
    @ApiProperty({ nullable: true }) ownerPageKey: string | null
    @ApiProperty({ nullable: true }) iframeHeight: number | null
    @ApiProperty() canEditContent: boolean
    @ApiProperty() canDelete: boolean
    @ApiProperty() canToggle: boolean
    @ApiProperty() canReorder: boolean
    @ApiProperty({ nullable: true }) editHref: string | null
    @ApiProperty() definitionRevision: number
    @ApiPropertyOptional() html?: string
    @ApiPropertyOptional() css?: string
    @ApiPropertyOptional() javascript?: string
}
export class AdminPageLayoutResponseDto {
    @ApiProperty() pageKey: string
    @ApiProperty() title: string
    @ApiProperty() routePattern: string
    @ApiProperty() revision: number
    @ApiProperty({ type: [PageSectionDescriptorDto] }) sections: PageSectionDescriptorDto[]
}
export class PublicPageSectionDto {
    @ApiProperty({ enum: SectionDefinitionType }) type: SectionDefinitionType
    @ApiProperty({ nullable: true }) key: string | null
    @ApiProperty() name: string
    @ApiProperty({ nullable: true }) systemRendererKey: string | null
    @ApiProperty({ nullable: true }) html: string | null
    @ApiProperty({ nullable: true }) css: string | null
    @ApiProperty({ nullable: true }) javascript: string | null
    @ApiProperty({ nullable: true }) iframeHeight: number | null
    @ApiProperty() isGlobal: boolean
    @ApiProperty() sortOrder: number
}
export class PublicPageLayoutResponseDto {
    @ApiProperty() pageKey: string
    @ApiProperty({ type: [PublicPageSectionDto] }) sections: PublicPageSectionDto[]
}
