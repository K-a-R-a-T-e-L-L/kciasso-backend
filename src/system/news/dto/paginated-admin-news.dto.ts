import { ApiProperty } from '@nestjs/swagger'

import { AdminNewsDto } from './admin-news.dto'
import { NewsPaginationMetaDto } from './news-pagination-meta.dto'

export class PaginatedAdminNewsDto {
    @ApiProperty({ type: () => [AdminNewsDto] })
    items: AdminNewsDto[]

    @ApiProperty({ type: () => NewsPaginationMetaDto })
    meta: NewsPaginationMetaDto
}
