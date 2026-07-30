import { ApiProperty } from '@nestjs/swagger'
export class PageRegistrySummaryDto {
    @ApiProperty() pageKey: string
    @ApiProperty() title: string
    @ApiProperty() routePattern: string
    @ApiProperty() revision: number
    @ApiProperty() totalSections: number
    @ApiProperty() visibleSections: number
    @ApiProperty() hiddenSections: number
    @ApiProperty() pageCustomHtmlSections: number
    @ApiProperty() globalCustomHtmlSections: number
    @ApiProperty() isMaterialized: boolean
}
