import { BadRequestException } from '@nestjs/common'
import { PublicationStatus } from '@prisma/client'

import { NewsService } from './news.service'
import { AdminNewsSort, AdminNewsStatusFilter } from '../dto/admin-news-query.dto'

describe('NewsService admin query contract', () => {
    const findMany = jest.fn().mockResolvedValue([])
    const count = jest.fn().mockResolvedValue(0)
    const prisma = {
        news: { findMany, count },
        $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
    }
    const service = new NewsService(prisma as never, {} as never)

    beforeEach(() => {
        jest.clearAllMocks()
        findMany.mockResolvedValue([])
        count.mockResolvedValue(0)
    })

    async function query(input: Parameters<NewsService['getAdminNews']>[0] = {}) {
        await service.getAdminNews(input)
        return {
            find: findMany.mock.calls[0][0],
            count: count.mock.calls[0][0],
        }
    }

    it('omits publication filters when status and isPublished are absent', async () => {
        const { find } = await query()
        expect(find.where).toEqual({ deleted_at: null })
    })

    it.each([
        [AdminNewsStatusFilter.DRAFT, PublicationStatus.DRAFT],
        [AdminNewsStatusFilter.SCHEDULED, PublicationStatus.SCHEDULED],
        [AdminNewsStatusFilter.PUBLISHED, PublicationStatus.PUBLISHED],
    ])('maps status %s to exact Prisma enum', async (status, expected) => {
        const { find } = await query({ status })
        expect(find.where.publication_status).toBe(expected)
    })

    it.each([true, false])('preserves legacy isPublished=%s', async isPublished => {
        const { find } = await query({ isPublished })
        expect(find.where.is_published).toBe(isPublished)
    })

    it('rejects status and isPublished together', async () => {
        await expect(service.getAdminNews({ status: AdminNewsStatusFilter.DRAFT, isPublished: false })).rejects.toEqual(
            new BadRequestException('NEWS_STATUS_FILTER_CONFLICT')
        )
    })

    it('keeps legacy ordering with a deterministic id tie-breaker when sort is omitted', async () => {
        const { find } = await query()
        expect(find.orderBy).toEqual([{ published_at: 'desc' }, { created_at: 'desc' }, { id: 'asc' }])
    })

    it.each([
        [
            AdminNewsSort.NEWEST,
            [{ published_at: { sort: 'desc', nulls: 'last' } }, { created_at: 'desc' }, { id: 'asc' }],
        ],
        [
            AdminNewsSort.OLDEST,
            [{ published_at: { sort: 'asc', nulls: 'first' } }, { created_at: 'asc' }, { id: 'asc' }],
        ],
        [AdminNewsSort.TITLE, [{ title: 'asc' }, { id: 'asc' }]],
    ])('maps sort %s to exact stable order', async (sort, expected) => {
        const { find } = await query({ sort })
        expect(find.orderBy).toEqual(expected)
    })

    it('uses the same where for count and findMany', async () => {
        const { find, count: countArgs } = await query({
            category: 'regional',
            search: 'exam',
            status: AdminNewsStatusFilter.PUBLISHED,
        })
        expect(countArgs.where).toBe(find.where)
    })

    it('applies skip and take after query selection', async () => {
        const { find } = await query({ page: 3, limit: 20, sort: AdminNewsSort.TITLE })
        expect(find).toMatchObject({ skip: 40, take: 20, orderBy: [{ title: 'asc' }, { id: 'asc' }] })
    })
})
