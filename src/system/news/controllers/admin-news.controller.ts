import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

import { ErrorDto } from '../../../_helpers/errors/error.dto'
import { RequireSectionPermission } from '../../user/decorators/require-section-permission.decorator'
import { UserDecorator } from '../../user/decorators/user.decorator'
import { AdminNewsCategoryDto } from '../dto/admin-news-category.dto'
import { AdminNewsDto } from '../dto/admin-news.dto'
import { AdminNewsQueryDto } from '../dto/admin-news-query.dto'
import { CreateNewsCategoryDto } from '../dto/create-news-category.dto'
import { CreateNewsDto } from '../dto/create-news.dto'
import { PaginatedAdminNewsDto } from '../dto/paginated-admin-news.dto'
import { UpdateNewsCategoryDto } from '../dto/update-news-category.dto'
import { UpdateNewsDto } from '../dto/update-news.dto'
import { NewsService } from '../services/news.service'

@Controller('admin')
@ApiTags('Admin News')
export class AdminNewsController {
    constructor(private readonly newsService: NewsService) {}

    @Get('news')
    @RequireSectionPermission('news')
    @ApiOperation({ summary: 'Get admin news list' })
    @ApiResponse({ status: 200, type: PaginatedAdminNewsDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    async getNews(@Query() query: AdminNewsQueryDto) {
        return this.newsService.getAdminNews(query)
    }

    @Get('news/:id')
    @RequireSectionPermission('news')
    @ApiOperation({ summary: 'Get admin news article by id' })
    @ApiResponse({ status: 200, type: AdminNewsDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    async getNewsById(@Param('id', ParseIntPipe) id: number) {
        return this.newsService.getAdminNewsById(id)
    }

    @Post('news')
    @RequireSectionPermission('news')
    @ApiOperation({ summary: 'Create news article' })
    @ApiResponse({ status: 201, type: AdminNewsDto })
    @ApiResponse({ status: 400, type: ErrorDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    async createNews(@Body() dto: CreateNewsDto, @UserDecorator() user: { id: number }) {
        return this.newsService.createNews(dto, user.id)
    }

    @Patch('news/:id')
    @RequireSectionPermission('news')
    @ApiOperation({ summary: 'Update news article' })
    @ApiResponse({ status: 200, type: AdminNewsDto })
    @ApiResponse({ status: 400, type: ErrorDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    async updateNews(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNewsDto) {
        return this.newsService.updateNews(id, dto)
    }

    @Delete('news/:id')
    @RequireSectionPermission('news')
    @ApiOperation({ summary: 'Soft-delete news article' })
    @ApiResponse({ status: 200, type: AdminNewsDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    async deleteNews(@Param('id', ParseIntPipe) id: number) {
        return this.newsService.deleteNews(id)
    }

    @Get('news-categories')
    @RequireSectionPermission('news')
    @ApiOperation({ summary: 'Get admin news categories' })
    @ApiResponse({ status: 200, type: AdminNewsCategoryDto, isArray: true })
    @ApiResponse({ status: 403, type: ErrorDto })
    async getCategories() {
        return this.newsService.getAdminCategories()
    }

    @Post('news-categories')
    @RequireSectionPermission('news')
    @ApiOperation({ summary: 'Create news category' })
    @ApiResponse({ status: 201, type: AdminNewsCategoryDto })
    @ApiResponse({ status: 400, type: ErrorDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    async createCategory(@Body() dto: CreateNewsCategoryDto) {
        return this.newsService.createCategory(dto)
    }

    @Patch('news-categories/:id')
    @RequireSectionPermission('news')
    @ApiOperation({ summary: 'Update news category' })
    @ApiResponse({ status: 200, type: AdminNewsCategoryDto })
    @ApiResponse({ status: 400, type: ErrorDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    async updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNewsCategoryDto) {
        return this.newsService.updateCategory(id, dto)
    }

    @Delete('news-categories/:id')
    @RequireSectionPermission('news')
    @ApiOperation({ summary: 'Deactivate news category' })
    @ApiResponse({ status: 200, type: AdminNewsCategoryDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    async deleteCategory(@Param('id', ParseIntPipe) id: number) {
        return this.newsService.deleteCategory(id)
    }
}
