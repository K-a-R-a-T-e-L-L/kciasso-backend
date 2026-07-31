import { INestApplication } from '@nestjs/common'
import { PublicationStatus } from '@prisma/client'
import * as request from 'supertest'

import { closeE2eContext, createE2eContext } from './helpers/e2e-context'

jest.setTimeout(120000)

describe('Admin news query contract (e2e)', () => {
    let app: INestApplication
    let context: Awaited<ReturnType<typeof createE2eContext>>
    let token: string
    let categoryId: number
    const categorySlug = 'part2c-query'

    beforeAll(async () => {
        context = await createE2eContext()
        app = context.app
        token = (
            await request(app.getHttpServer())
                .post('/api/user/authenticate')
                .send({
                    email: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
                    password: process.env.SUPER_ADMIN_PASSWORD || 'change_me_12345',
                })
        ).body.token

        const category = await context.prisma.newsCategory.create({
            data: { slug: categorySlug, title: 'Part 2C query', order: 900, is_active: true },
        })
        const decoyCategory = await context.prisma.newsCategory.create({
            data: { slug: 'part2c-query-decoy', title: 'Part 2C query decoy', order: 901, is_active: true },
        })
        categoryId = category.id
        const base = new Date('2026-01-01T00:00:00.000Z')
        await context.prisma.news.createMany({
            data: [
                row('draft-null-a', 'Same title', PublicationStatus.DRAFT, null, 1),
                row('draft-null-b', 'Same title', PublicationStatus.DRAFT, null, 2),
                row('scheduled-a', 'Zulu', PublicationStatus.SCHEDULED, new Date('2026-03-01T00:00:00Z'), 3),
                row('scheduled-b', 'Echo', PublicationStatus.SCHEDULED, new Date('2026-04-01T00:00:00Z'), 4),
                row('published-a', 'Alpha', PublicationStatus.PUBLISHED, new Date('2026-01-10T00:00:00Z'), 5),
                row('published-b', 'Bravo', PublicationStatus.PUBLISHED, new Date('2026-02-10T00:00:00Z'), 6),
                row('published-equal-a', 'Equal A', PublicationStatus.PUBLISHED, base, 7),
                row('published-equal-b', 'Equal B', PublicationStatus.PUBLISHED, base, 8),
                {
                    ...row('decoy', 'Equal decoy', PublicationStatus.PUBLISHED, base, 9),
                    category_id: decoyCategory.id,
                },
            ],
        })
    })

    afterAll(async () => {
        await closeE2eContext(context)
    })

    function row(
        slug: string,
        title: string,
        publicationStatus: PublicationStatus,
        publishedAt: Date | null,
        createdOffset: number
    ) {
        return {
            slug: `part2c-${slug}`,
            title,
            excerpt: `query ${slug}`,
            content: `content ${slug}`,
            category_id: categoryId,
            publication_status: publicationStatus,
            is_published: publicationStatus !== PublicationStatus.DRAFT,
            published_at: publishedAt,
            created_at: new Date(Date.UTC(2026, 0, createdOffset)),
            updated_at: new Date(Date.UTC(2026, 0, createdOffset)),
        }
    }

    function get(query = '') {
        return request(app.getHttpServer())
            .get(`/api/admin/news?category=${categorySlug}${query}`)
            .set('Authorization', `Bearer ${token}`)
    }

    it('preserves omitted-field success and legacy isPublished behavior', async () => {
        expect((await get('&limit=100')).status).toBe(200)
        expect((await get('&isPublished=false&limit=100')).body.items).toHaveLength(2)
        expect((await get('&isPublished=true&limit=100')).body.items).toHaveLength(6)
    })

    it.each([
        ['draft', 2],
        ['scheduled', 2],
        ['published', 4],
    ])('filters status=%s before count and pagination', async (status, total) => {
        const response = await get(`&status=${status}&limit=1`)
        expect(response.status).toBe(200)
        expect(response.body.items).toHaveLength(1)
        expect(response.body.meta.total).toBe(total)
        expect(response.body.items[0].status).toBe(status)
    })

    it('rejects status/isPublished conflict and invalid enums', async () => {
        const conflict = await get('&status=draft&isPublished=false')
        expect(conflict.status).toBe(400)
        expect(conflict.body.message).toBe('NEWS_STATUS_FILTER_CONFLICT')
        expect((await get('&status=DRAFT')).status).toBe(400)
        expect((await get('&sort=random')).status).toBe(400)
    })

    it('sorts newest globally before pagination with nulls last', async () => {
        const first = await get('&sort=newest&limit=2&page=1')
        const second = await get('&sort=newest&limit=2&page=2')
        const third = await get('&sort=newest&limit=2&page=3')
        const fourth = await get('&sort=newest&limit=2&page=4')
        const full = await get('&sort=newest&limit=100')
        expect(first.body.items.map((item: { slug: string }) => item.slug)).toEqual([
            'part2c-scheduled-b',
            'part2c-scheduled-a',
        ])
        const pagedIds = [...first.body.items, ...second.body.items, ...third.body.items, ...fourth.body.items].map(
            (item: { id: number }) => item.id
        )
        expect(new Set(pagedIds).size).toBe(8)
        expect(pagedIds).toEqual(full.body.items.map((item: { id: number }) => item.id))
    })

    it('sorts oldest globally with nulls first and stable id order', async () => {
        const response = await get('&sort=oldest&limit=100')
        expect(response.body.items.slice(0, 2).map((item: { slug: string }) => item.slug)).toEqual([
            'part2c-draft-null-a',
            'part2c-draft-null-b',
        ])
    })

    it('sorts title globally and uses id as the final tie-breaker', async () => {
        const response = await get('&sort=title&limit=100')
        const titles = response.body.items.map((item: { title: string }) => item.title)
        expect(titles).toEqual([...titles].sort())
        const equal = response.body.items.filter((item: { title: string }) => item.title === 'Same title')
        expect(equal[0].id).toBeLessThan(equal[1].id)
    })

    it('combines search, category and status with the same count set', async () => {
        const response = await get('&status=published&search=Equal&limit=1')
        expect(response.body.items).toHaveLength(1)
        expect(response.body.meta.total).toBe(2)
        expect(response.body.meta.totalPages).toBe(2)
    })

    it('exposes exact enums and preserves isPublished in docs-json', async () => {
        const response = await request(app.getHttpServer()).get('/api/docs-json')
        expect(response.status).toBe(200)
        const parameters = response.body.paths['/api/admin/news'].get.parameters
        const byName = Object.fromEntries(parameters.map((parameter: { name: string }) => [parameter.name, parameter]))
        expect(byName.status.schema.enum).toEqual(['draft', 'scheduled', 'published'])
        expect(byName.sort.schema.enum).toEqual(['newest', 'oldest', 'title'])
        expect(byName.isPublished.schema.type).toBe('boolean')
    })
})
