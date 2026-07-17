import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { News, NewsCategory, Prisma, User } from '@prisma/client'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

import { ErrorCodeEnum } from '../../../_helpers/enums/validator/error.code.enum'
import { ErrorDto } from '../../../_helpers/errors/error.dto'
import { PrismaService } from '../../../prisma/prisma.service'
import { AdminNewsCategoryDto } from '../dto/admin-news-category.dto'
import { AdminNewsQueryDto } from '../dto/admin-news-query.dto'
import { AdminNewsDto } from '../dto/admin-news.dto'
import { CreateNewsCategoryDto } from '../dto/create-news-category.dto'
import { CreateNewsDto } from '../dto/create-news.dto'
import { NewsArticleDto } from '../dto/news-article.dto'
import { NewsCategoryDto } from '../dto/news-category.dto'
import { NewsListItemDto } from '../dto/news-list-item.dto'
import { NewsPaginationMetaDto } from '../dto/news-pagination-meta.dto'
import { NewsQueryDto } from '../dto/news-query.dto'
import { NEWS_STATUS, NewsStatus } from '../dto/news-status.dto'
import { PaginatedAdminNewsDto } from '../dto/paginated-admin-news.dto'
import { PaginatedNewsDto } from '../dto/paginated-news.dto'
import { UpdateNewsCategoryDto } from '../dto/update-news-category.dto'
import { UpdateNewsDto } from '../dto/update-news.dto'
import { NewsMediaService } from '../media/news-media.service'

type NewsWithRelations = News & {
    category: NewsCategory | null
    author: Pick<User, 'id' | 'name' | 'email'> | null
}

@Injectable()
export class NewsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly media: NewsMediaService
    ) {}

    async getPublicNews(query: NewsQueryDto): Promise<PaginatedNewsDto> {
        const page = query.page ?? 1
        const limit = query.limit ?? 10
        const where = this.buildPublicNewsWhere(query)

        const [items, total] = await this.prisma.$transaction([
            this.prisma.news.findMany({
                where,
                include: {
                    category: true,
                },
                orderBy: [{ published_at: 'desc' }, { created_at: 'desc' }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.news.count({ where }),
        ])

        return {
            items: items.map(item => this.toNewsListItemDto(item)),
            meta: this.toPaginationMeta(page, limit, total),
        }
    }

    async getPublicNewsBySlug(slug: string): Promise<NewsArticleDto> {
        const item = await this.prisma.news.findFirst({
            where: {
                slug,
                is_published: true,
                published_at: {
                    lte: new Date(),
                },
                deleted_at: null,
            },
            include: {
                category: true,
            },
        })

        if (!item) {
            throw new NotFoundException(
                new ErrorDto(ErrorCodeEnum.ENTITY_NOT_FOUND, 'Not Found', 404, 'News not found')
            )
        }

        return this.toNewsArticleDto(item)
    }

    async getPublicCategories(): Promise<NewsCategoryDto[]> {
        const categories = await this.prisma.newsCategory.findMany({
            where: {
                is_active: true,
            },
            orderBy: [{ order: 'asc' }, { title: 'asc' }],
        })

        return categories.map(category => this.toNewsCategoryDto(category))
    }

    async getAdminNews(query: AdminNewsQueryDto): Promise<PaginatedAdminNewsDto> {
        const page = query.page ?? 1
        const limit = query.limit ?? 10
        const where = this.buildAdminNewsWhere(query)

        const [items, total] = await this.prisma.$transaction([
            this.prisma.news.findMany({
                where,
                include: {
                    category: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: [{ published_at: 'desc' }, { created_at: 'desc' }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.news.count({ where }),
        ])

        return {
            items: items.map(item => this.toAdminNewsDto(item)),
            meta: this.toPaginationMeta(page, limit, total),
        }
    }

    async getAdminNewsById(id: number): Promise<AdminNewsDto> {
        const item = await this.findAdminNewsOrThrow(id)
        return this.toAdminNewsDto(item)
    }

    async createNews(dto: CreateNewsDto, authorId?: number): Promise<AdminNewsDto> {
        await this.ensureCategoryExists(dto.categoryId)

        try {
            const item = await this.prisma.news.create({
                data: {
                    slug: dto.slug.trim(),
                    title: dto.title.trim(),
                    excerpt: dto.excerpt.trim(),
                    content: dto.content.trim(),
                    cover_image_url: dto.coverImageUrl?.trim() || null,
                    is_published: dto.isPublished ?? false,
                    published_at: this.resolvePublishedAt(dto.isPublished ?? false, dto.publishedAt),
                    category_id: dto.categoryId ?? null,
                    author_id: authorId ?? null,
                },
                include: {
                    category: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            })

            return this.toAdminNewsDto(item)
        } catch (error) {
            this.rethrowKnownError(error, 'News slug is already in use')
        }
    }

    async updateNews(id: number, dto: UpdateNewsDto): Promise<AdminNewsDto> {
        const previous = await this.findAdminNewsOrThrow(id)
        await this.ensureCategoryExists(dto.categoryId)

        const nextIsPublished = dto.isPublished
        const shouldSetPublishedNow = nextIsPublished === true && dto.publishedAt === undefined

        try {
            const item = await this.prisma.news.update({
                where: { id },
                data: {
                    ...(dto.slug !== undefined ? { slug: dto.slug.trim() } : {}),
                    ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
                    ...(dto.excerpt !== undefined ? { excerpt: dto.excerpt.trim() } : {}),
                    ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
                    ...(dto.coverImageUrl !== undefined ? { cover_image_url: dto.coverImageUrl?.trim() || null } : {}),
                    ...(dto.categoryId !== undefined ? { category_id: dto.categoryId ?? null } : {}),
                    ...(dto.isPublished !== undefined ? { is_published: dto.isPublished } : {}),
                    ...(dto.publishedAt !== undefined
                        ? { published_at: dto.publishedAt }
                        : shouldSetPublishedNow
                          ? { published_at: new Date() }
                          : {}),
                },
                include: {
                    category: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            })

            if (dto.coverImageUrl !== undefined && item.cover_image_url !== previous.cover_image_url) {
                await this.media.deleteOwnedUrlIfUnreferenced(previous.cover_image_url)
            }
            return this.toAdminNewsDto(item)
        } catch (error) {
            this.rethrowKnownError(error, 'News slug is already in use')
        }
    }

    async deleteNews(id: number): Promise<AdminNewsDto> {
        const previous = await this.findAdminNewsOrThrow(id)

        const item = await this.prisma.news.update({
            where: { id },
            data: {
                deleted_at: new Date(),
            },
            include: {
                category: true,
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        })

        await this.media.deleteOwnedUrlIfUnreferenced(previous.cover_image_url)
        return this.toAdminNewsDto(item)
    }

    async getAdminCategories(): Promise<AdminNewsCategoryDto[]> {
        const categories = await this.prisma.newsCategory.findMany({
            orderBy: [{ order: 'asc' }, { title: 'asc' }],
        })

        return this.attachNewsCounts(categories)
    }

    async createCategory(dto: CreateNewsCategoryDto): Promise<AdminNewsCategoryDto> {
        try {
            const category = await this.prisma.newsCategory.create({
                data: {
                    slug: dto.slug.trim(),
                    title: dto.title.trim(),
                    description: dto.description?.trim() || null,
                    order: dto.order ?? 0,
                    is_active: dto.isActive ?? true,
                },
            })

            return this.toAdminNewsCategoryDto(category, 0)
        } catch (error) {
            this.rethrowKnownError(error, 'Category slug is already in use')
        }
    }

    async updateCategory(id: number, dto: UpdateNewsCategoryDto): Promise<AdminNewsCategoryDto> {
        await this.findCategoryOrThrow(id)

        try {
            const category = await this.prisma.newsCategory.update({
                where: { id },
                data: {
                    ...(dto.slug !== undefined ? { slug: dto.slug.trim() } : {}),
                    ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
                    ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
                    ...(dto.order !== undefined ? { order: dto.order } : {}),
                    ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
                },
            })

            const newsCount = await this.prisma.news.count({
                where: {
                    category_id: category.id,
                    deleted_at: null,
                },
            })

            return this.toAdminNewsCategoryDto(category, newsCount)
        } catch (error) {
            this.rethrowKnownError(error, 'Category slug is already in use')
        }
    }

    async deleteCategory(id: number): Promise<AdminNewsCategoryDto> {
        const category = await this.findCategoryOrThrow(id)
        const linkedNewsCount = await this.prisma.news.count({
            where: {
                category_id: category.id,
                deleted_at: null,
            },
        })

        if (linkedNewsCount > 0) {
            throw new BadRequestException(
                new ErrorDto(
                    ErrorCodeEnum.INVALID_QUERY_STRING,
                    'Bad Request',
                    400,
                    'Category cannot be deleted while it is used by news articles'
                )
            )
        }

        await this.prisma.newsCategory.delete({
            where: { id: category.id },
        })

        return this.toAdminNewsCategoryDto(category, linkedNewsCount)
    }

    private buildPublicNewsWhere(query: NewsQueryDto): Prisma.NewsWhereInput {
        return {
            is_published: true,
            published_at: {
                lte: new Date(),
            },
            deleted_at: null,
            ...(query.category
                ? {
                      category: {
                          slug: query.category,
                          is_active: true,
                      },
                  }
                : {}),
            ...(query.search
                ? {
                      OR: [
                          {
                              title: {
                                  contains: query.search,
                                  mode: 'insensitive',
                              },
                          },
                          {
                              excerpt: {
                                  contains: query.search,
                                  mode: 'insensitive',
                              },
                          },
                          {
                              content: {
                                  contains: query.search,
                                  mode: 'insensitive',
                              },
                          },
                      ],
                  }
                : {}),
        }
    }

    private buildAdminNewsWhere(query: AdminNewsQueryDto): Prisma.NewsWhereInput {
        return {
            deleted_at: null,
            ...(query.category
                ? {
                      category: {
                          slug: query.category,
                      },
                  }
                : {}),
            ...(query.isPublished !== undefined
                ? {
                      is_published: query.isPublished,
                  }
                : {}),
            ...(query.search
                ? {
                      OR: [
                          {
                              title: {
                                  contains: query.search,
                                  mode: 'insensitive',
                              },
                          },
                          {
                              excerpt: {
                                  contains: query.search,
                                  mode: 'insensitive',
                              },
                          },
                          {
                              content: {
                                  contains: query.search,
                                  mode: 'insensitive',
                              },
                          },
                      ],
                  }
                : {}),
        }
    }

    private resolvePublishedAt(isPublished: boolean, publishedAt?: Date) {
        if (publishedAt !== undefined) {
            return publishedAt
        }

        if (isPublished) {
            return new Date()
        }

        return null
    }

    private async ensureCategoryExists(categoryId?: number) {
        if (categoryId === undefined || categoryId === null) {
            return
        }

        const category = await this.prisma.newsCategory.findUnique({
            where: { id: categoryId },
            select: { id: true },
        })

        if (!category) {
            throw new NotFoundException(
                new ErrorDto(ErrorCodeEnum.ENTITY_NOT_FOUND, 'Not Found', 404, 'News category not found')
            )
        }
    }

    private async findCategoryOrThrow(id: number): Promise<NewsCategory> {
        const category = await this.prisma.newsCategory.findUnique({
            where: { id },
        })

        if (!category) {
            throw new NotFoundException(
                new ErrorDto(ErrorCodeEnum.ENTITY_NOT_FOUND, 'Not Found', 404, 'News category not found')
            )
        }

        return category
    }

    private async findAdminNewsOrThrow(id: number): Promise<NewsWithRelations> {
        const item = await this.prisma.news.findFirst({
            where: {
                id,
                deleted_at: null,
            },
            include: {
                category: true,
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        })

        if (!item) {
            throw new NotFoundException(
                new ErrorDto(ErrorCodeEnum.ENTITY_NOT_FOUND, 'Not Found', 404, 'News not found')
            )
        }

        return item
    }

    private rethrowKnownError(error: unknown, slugDescription: string): never {
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new BadRequestException(
                new ErrorDto(ErrorCodeEnum.SLUG_ALREADY_IN_USE, 'Bad Request', 400, slugDescription)
            )
        }

        throw error
    }

    private toPaginationMeta(page: number, limit: number, total: number): NewsPaginationMetaDto {
        return {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        }
    }

    private toNewsCategoryDto(category: NewsCategory): NewsCategoryDto {
        return {
            id: category.id,
            slug: category.slug,
            title: category.title,
            description: category.description,
        }
    }

    private async attachNewsCounts(categories: NewsCategory[]): Promise<AdminNewsCategoryDto[]> {
        if (categories.length === 0) {
            return []
        }

        const counts = await this.prisma.news.groupBy({
            by: ['category_id'],
            where: {
                deleted_at: null,
                category_id: {
                    in: categories.map(category => category.id),
                },
            },
            _count: {
                _all: true,
            },
        })

        const countsByCategoryId = new Map<number, number>()
        for (const item of counts) {
            if (item.category_id === null) {
                continue
            }

            countsByCategoryId.set(item.category_id, item._count._all)
        }

        return categories.map(category =>
            this.toAdminNewsCategoryDto(category, countsByCategoryId.get(category.id) ?? 0)
        )
    }

    private toAdminNewsCategoryDto(category: NewsCategory, newsCount = 0): AdminNewsCategoryDto {
        return {
            id: category.id,
            slug: category.slug,
            title: category.title,
            description: category.description,
            order: category.order,
            isActive: category.is_active,
            newsCount,
            createdAt: category.created_at,
            updatedAt: category.updated_at,
        }
    }

    private toNewsListItemDto(item: News & { category: NewsCategory | null }): NewsListItemDto {
        return {
            id: item.id,
            slug: item.slug,
            title: item.title,
            excerpt: item.excerpt,
            coverImageUrl: item.cover_image_url,
            publishedAt: item.published_at,
            category: item.category ? this.toNewsCategoryDto(item.category) : null,
        }
    }

    private toNewsArticleDto(item: News & { category: NewsCategory | null }): NewsArticleDto {
        return {
            id: item.id,
            slug: item.slug,
            title: item.title,
            excerpt: item.excerpt,
            content: item.content,
            coverImageUrl: item.cover_image_url,
            publishedAt: item.published_at,
            category: item.category ? this.toNewsCategoryDto(item.category) : null,
        }
    }

    private toAdminNewsDto(item: NewsWithRelations): AdminNewsDto {
        return {
            id: item.id,
            slug: item.slug,
            title: item.title,
            excerpt: item.excerpt,
            content: item.content,
            coverImageUrl: item.cover_image_url,
            publishedAt: item.published_at,
            isPublished: item.is_published,
            status: this.resolveAdminNewsStatus(item),
            category: item.category ? this.toAdminNewsCategoryDto(item.category) : null,
            author: item.author
                ? {
                      id: item.author.id,
                      name: item.author.name,
                      email: item.author.email,
                  }
                : null,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
            deletedAt: item.deleted_at,
        }
    }

    private resolveAdminNewsStatus(item: Pick<News, 'is_published' | 'published_at'>): NewsStatus {
        if (!item.is_published) {
            return NEWS_STATUS.DRAFT
        }

        if (item.published_at && item.published_at.getTime() > Date.now()) {
            return NEWS_STATUS.SCHEDULED
        }

        return NEWS_STATUS.PUBLISHED
    }
}
