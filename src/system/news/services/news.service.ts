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
import { NEWS_CATEGORY_MOVE_DIRECTION } from '../dto/move-news-category.dto'
import { NewsArticleDto } from '../dto/news-article.dto'
import { NewsCategoryDto } from '../dto/news-category.dto'
import { NewsListItemDto } from '../dto/news-list-item.dto'
import { NewsPaginationMetaDto } from '../dto/news-pagination-meta.dto'
import { NewsQueryDto } from '../dto/news-query.dto'
import { NEWS_STATUS, NewsStatus } from '../dto/news-status.dto'
import { PaginatedAdminNewsDto } from '../dto/paginated-admin-news.dto'
import { PaginatedNewsDto } from '../dto/paginated-news.dto'
import { PublicationCommandDto } from '../dto/publication-command.dto'
import { UpdateNewsCategoryDto } from '../dto/update-news-category.dto'
import { UpdateNewsDto } from '../dto/update-news.dto'
import { NewsMediaService } from '../media/news-media.service'
import { normalizeSlug, slugCandidate } from '../utils/slug.util'

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
                orderBy: [{ display_published_at: 'desc' }, { published_at: 'desc' }, { created_at: 'desc' }],
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
                AND: [
                    {
                        OR: [
                            { publication_status: { in: ['PUBLISHED', 'SCHEDULED'] } },
                            { publication_status: 'DRAFT', is_published: true },
                        ],
                    },
                    { OR: [{ publish_from: null }, { publish_from: { lte: new Date() } }] },
                    { OR: [{ publish_until: null }, { publish_until: { gt: new Date() } }] },
                ],
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

        const title = dto.title.trim()
        const manualSlug = this.manualSlugOrThrow(dto.slug)
        const baseSlug = manualSlug ?? this.generatedSlug(title, 'news')
        for (let attempt = 0; attempt < 20; attempt += 1) {
            const slug = manualSlug ? baseSlug : this.withSuffix(baseSlug, attempt)
            try {
                const item = await this.prisma.news.create({
                    data: {
                        slug,
                        title,
                        excerpt: dto.excerpt.trim(),
                        content: dto.content.trim(),
                        cover_image_url: dto.coverImageUrl?.trim() || null,
                        is_published: dto.isPublished ?? false,
                        published_at: this.resolvePublishedAt(dto.isPublished ?? false, dto.publishedAt),
                        publication_status: dto.isPublished
                            ? dto.publishedAt && dto.publishedAt > new Date()
                                ? 'SCHEDULED'
                                : 'PUBLISHED'
                            : 'DRAFT',
                        publish_from: dto.publishedAt ?? (dto.isPublished ? new Date() : null),
                        publish_until: dto.publishUntil ?? null,
                        display_published_at:
                            dto.displayPublishedAt ?? dto.publishedAt ?? (dto.isPublished ? new Date() : null),
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
                if (this.isUniqueViolation(error) && !manualSlug) continue
                this.rethrowKnownError(
                    error,
                    manualSlug ? 'Такой slug уже используется' : 'Не удалось создать уникальный slug'
                )
            }
        }
        throw new BadRequestException(
            new ErrorDto(ErrorCodeEnum.SLUG_ALREADY_IN_USE, 'Bad Request', 400, 'Не удалось создать уникальный slug')
        )
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
                    ...(dto.slug !== undefined ? { slug: this.manualSlugOrThrow(dto.slug) } : {}),
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
                    ...(dto.publishUntil !== undefined ? { publish_until: dto.publishUntil } : {}),
                    ...(dto.displayPublishedAt !== undefined ? { display_published_at: dto.displayPublishedAt } : {}),
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
            this.rethrowKnownError(error, 'Такой slug уже используется')
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

    async applyPublicationCommand(id: number, dto: PublicationCommandDto): Promise<AdminNewsDto> {
        const item = await this.findAdminNewsOrThrow(id)
        const now = new Date()
        const from = dto.publishFrom ? new Date(dto.publishFrom) : now
        const until = dto.publishUntil ? new Date(dto.publishUntil) : null
        const display = dto.displayPublishedAt ? new Date(dto.displayPublishedAt) : from
        if (until && until <= from) throw new BadRequestException('publishUntil must be after publishFrom')
        if (dto.command === 'schedule' && from <= now)
            throw new BadRequestException('publishFrom must be in the future')
        if (dto.command === 'publish_as_of' && !dto.displayPublishedAt)
            throw new BadRequestException('displayPublishedAt is required')
        const data =
            dto.command === 'draft'
                ? { publication_status: 'DRAFT' as const, is_published: false, publish_from: null, publish_until: null }
                : dto.command === 'schedule'
                  ? {
                        publication_status: 'SCHEDULED' as const,
                        is_published: true,
                        publish_from: from,
                        publish_until: until,
                    }
                  : {
                        publication_status: 'PUBLISHED' as const,
                        is_published: true,
                        publish_from: now,
                        publish_until: until,
                    }
        const updated = await this.prisma.news.update({
            where: { id },
            data: {
                ...data,
                published_at: dto.command === 'draft' ? null : from,
                display_published_at: dto.command === 'draft' ? item.display_published_at : display,
                publication_revision: { increment: 1 },
            },
            include: { category: true, author: { select: { id: true, name: true, email: true } } },
        })
        return this.toAdminNewsDto(updated)
    }

    async getAdminCategories(): Promise<AdminNewsCategoryDto[]> {
        const categories = await this.prisma.newsCategory.findMany({
            orderBy: [{ order: 'asc' }, { title: 'asc' }],
        })

        return this.attachNewsCounts(categories)
    }

    async createCategory(dto: CreateNewsCategoryDto): Promise<AdminNewsCategoryDto> {
        const title = dto.title.trim()
        const manualSlug = this.manualSlugOrThrow(dto.slug)
        const baseSlug = manualSlug ?? this.generatedSlug(title, 'category')
        for (let attempt = 0; attempt < 20; attempt += 1) {
            const slug = manualSlug ? baseSlug : this.withSuffix(baseSlug, attempt)
            try {
                const category = await this.prisma.$transaction(async transaction => {
                    await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(780534092)')
                    const order =
                        dto.order ??
                        ((await transaction.newsCategory.aggregate({ _max: { order: true } }))._max.order ?? -1) + 1
                    return transaction.newsCategory.create({
                        data: {
                            slug,
                            title,
                            description: dto.description?.trim() || null,
                            order,
                            is_active: dto.isActive ?? true,
                        },
                    })
                })

                return this.toAdminNewsCategoryDto(category, 0)
            } catch (error) {
                if (this.isUniqueViolation(error) && !manualSlug) continue
                this.rethrowKnownError(
                    error,
                    manualSlug ? 'Такой slug уже используется' : 'Не удалось создать уникальный slug'
                )
            }
        }
        throw new BadRequestException(
            new ErrorDto(ErrorCodeEnum.SLUG_ALREADY_IN_USE, 'Bad Request', 400, 'Не удалось создать уникальный slug')
        )
    }

    async updateCategory(id: number, dto: UpdateNewsCategoryDto): Promise<AdminNewsCategoryDto> {
        await this.findCategoryOrThrow(id)

        try {
            const category = await this.prisma.newsCategory.update({
                where: { id },
                data: {
                    ...(dto.slug !== undefined ? { slug: this.manualSlugOrThrow(dto.slug) } : {}),
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
            this.rethrowKnownError(error, 'Такой slug уже используется')
        }
    }

    async moveCategory(
        id: number,
        direction: NEWS_CATEGORY_MOVE_DIRECTION
    ): Promise<{ items: AdminNewsCategoryDto[] }> {
        if (![NEWS_CATEGORY_MOVE_DIRECTION.UP, NEWS_CATEGORY_MOVE_DIRECTION.DOWN].includes(direction)) {
            throw new BadRequestException(
                new ErrorDto(ErrorCodeEnum.INVALID_QUERY_STRING, 'Bad Request', 400, 'Invalid move direction')
            )
        }

        const categories = await this.prisma.$transaction(async transaction => {
            await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(780534092)')
            const all = await transaction.newsCategory.findMany({
                orderBy: [{ order: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
            })
            const targetIndex = all.findIndex(category => category.id === id)
            if (targetIndex < 0) {
                throw new NotFoundException(
                    new ErrorDto(ErrorCodeEnum.ENTITY_NOT_FOUND, 'Not Found', 404, 'News category not found')
                )
            }
            const normalized = all.map((category, index) => ({ ...category, order: index }))
            const offset = direction === NEWS_CATEGORY_MOVE_DIRECTION.UP ? -1 : 1
            const neighbourIndex = targetIndex + offset
            if (neighbourIndex >= 0 && neighbourIndex < normalized.length) {
                const current = normalized[targetIndex]
                normalized[targetIndex] = normalized[neighbourIndex]
                normalized[neighbourIndex] = current
            }
            for (const [index, category] of normalized.entries()) {
                if (category.order !== index)
                    await transaction.newsCategory.update({ where: { id: category.id }, data: { order: index } })
            }
            return transaction.newsCategory.findMany({ orderBy: [{ order: 'asc' }, { id: 'asc' }] })
        })
        const withCounts = await this.attachNewsCounts(categories)
        return { items: withCounts }
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
            AND: [
                {
                    OR: [
                        { publication_status: { in: ['PUBLISHED', 'SCHEDULED'] } },
                        { publication_status: 'DRAFT', is_published: true },
                    ],
                },
                { OR: [{ publish_from: null }, { publish_from: { lte: new Date() } }] },
                { OR: [{ publish_until: null }, { publish_until: { gt: new Date() } }] },
            ],
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

    private isUniqueViolation(error: unknown): boolean {
        return error instanceof PrismaClientKnownRequestError && error.code === 'P2002'
    }

    private generatedSlug(value: string, fallback: string): string {
        try {
            return slugCandidate(value)
        } catch {
            throw new BadRequestException(
                new ErrorDto(
                    ErrorCodeEnum.INVALID_QUERY_STRING,
                    'Bad Request',
                    400,
                    `Не удалось создать slug из ${fallback === 'news' ? 'заголовка' : 'названия'}`
                )
            )
        }
    }

    private manualSlugOrThrow(value?: string | null): string | undefined {
        const raw = value?.trim()
        if (!raw) return undefined
        const normalized = normalizeSlug(raw)
        if (!normalized) {
            throw new BadRequestException(
                new ErrorDto(ErrorCodeEnum.INVALID_QUERY_STRING, 'Bad Request', 400, 'Некорректный slug')
            )
        }
        return normalized
    }

    private withSuffix(base: string, attempt: number): string {
        return attempt === 0 ? base : `${base}-${attempt + 1}`
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
            publishedAt: item.display_published_at ?? item.published_at,
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
            publishedAt: item.display_published_at ?? item.published_at,
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
            status:
                item.publication_status === 'SCHEDULED'
                    ? NEWS_STATUS.SCHEDULED
                    : item.publication_status === 'PUBLISHED'
                      ? NEWS_STATUS.PUBLISHED
                      : NEWS_STATUS.DRAFT,
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
