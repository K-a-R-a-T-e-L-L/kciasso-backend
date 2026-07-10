import { ApiProperty } from '@nestjs/swagger'

import { NewsListItemDto } from './news-list-item.dto'
import { NewsPaginationMetaDto } from './news-pagination-meta.dto'

export class PaginatedNewsDto {
    @ApiProperty({ type: () => [NewsListItemDto] })
    items: NewsListItemDto[]

    @ApiProperty({ type: () => NewsPaginationMetaDto })
    meta: NewsPaginationMetaDto
}
