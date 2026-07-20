import { ApiProperty } from '@nestjs/swagger'

import { AdminNewsCategoryDto } from './admin-news-category.dto'

export class NewsCategoryMoveResponseDto {
    @ApiProperty({ type: AdminNewsCategoryDto, isArray: true })
    items!: AdminNewsCategoryDto[]
}
