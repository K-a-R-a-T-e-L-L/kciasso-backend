import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

import { ErrorDto } from '../../../_helpers/errors/error.dto'
import { NewsArticleDto } from '../dto/news-article.dto'
import { NewsCategoryDto } from '../dto/news-category.dto'
import { NewsQueryDto } from '../dto/news-query.dto'
import { PaginatedNewsDto } from '../dto/paginated-news.dto'
import { NewsService } from '../services/news.service'

@Controller('public')
@ApiTags('Public News')
export class PublicNewsController {
    constructor(private readonly newsService: NewsService) {}

    @Get('news')
    @ApiOperation({ summary: 'Get published news list' })
    @ApiResponse({ status: 200, type: PaginatedNewsDto })
    @ApiResponse({ status: 400, type: ErrorDto })
    async getNews(@Query() query: NewsQueryDto) {
        return this.newsService.getPublicNews(query)
    }

    @Get('news/:slug')
    @ApiOperation({ summary: 'Get published news article by slug' })
    @ApiResponse({ status: 200, type: NewsArticleDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    async getNewsBySlug(@Param('slug') slug: string) {
        return this.newsService.getPublicNewsBySlug(slug)
    }

    @Get('news-categories')
    @ApiOperation({ summary: 'Get active news categories' })
    @ApiResponse({ status: 200, type: NewsCategoryDto, isArray: true })
    async getCategories() {
        return this.newsService.getPublicCategories()
    }
}
