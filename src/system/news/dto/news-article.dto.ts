import { ApiProperty } from '@nestjs/swagger'

import { NewsCategoryDto } from './news-category.dto'

export class NewsArticleDto {
    @ApiProperty()
    id: number

    @ApiProperty()
    slug: string

    @ApiProperty()
    title: string

    @ApiProperty()
    excerpt: string

    @ApiProperty()
    content: string

    @ApiProperty({ required: false, nullable: true })
    coverImageUrl?: string | null

    @ApiProperty({ required: false, nullable: true })
    publishedAt?: Date | null

    @ApiProperty({ required: false, type: () => NewsCategoryDto, nullable: true })
    category?: NewsCategoryDto | null
}
