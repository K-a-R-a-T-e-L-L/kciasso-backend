import { ApiProperty } from '@nestjs/swagger'

import { AdminNewsCategoryDto } from './admin-news-category.dto'
import { NEWS_STATUS, NewsStatus } from './news-status.dto'

class AdminNewsAuthorDto {
    @ApiProperty()
    id: number

    @ApiProperty()
    name: string

    @ApiProperty()
    email: string
}

export class AdminNewsDto {
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

    @ApiProperty()
    isPublished: boolean

    @ApiProperty({
        enum: NEWS_STATUS,
        enumName: 'NewsStatus',
    })
    status: NewsStatus

    @ApiProperty({ required: false, nullable: true, type: () => AdminNewsCategoryDto })
    category?: AdminNewsCategoryDto | null

    @ApiProperty({ required: false, nullable: true, type: () => AdminNewsAuthorDto })
    author?: AdminNewsAuthorDto | null

    @ApiProperty()
    createdAt: Date

    @ApiProperty()
    updatedAt: Date

    @ApiProperty({ required: false, nullable: true })
    deletedAt?: Date | null
}
