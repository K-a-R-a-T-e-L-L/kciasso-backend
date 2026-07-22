import { closeE2eContext, createE2eContext } from './helpers/e2e-context'
import { PublicationSweepService } from '../src/system/publication/publication-sweep.service'

describe('publication sweep integration', () => {
    let context: Awaited<ReturnType<typeof createE2eContext>>
    beforeAll(async () => {
        context = await createE2eContext()
    })
    afterAll(async () => {
        await closeE2eContext(context)
    })
    it('activates scheduled and expires expired rows idempotently', async () => {
        const now = new Date()
        const scheduled = await context.prisma.news.create({
            data: {
                slug: `sweep-${Date.now()}`,
                title: 's',
                excerpt: 's',
                content: 's',
                publication_status: 'SCHEDULED',
                publish_from: new Date(now.getTime() - 1000),
                display_published_at: now,
            },
        })
        const expired = await context.prisma.news.create({
            data: {
                slug: `expired-${Date.now()}`,
                title: 'e',
                excerpt: 'e',
                content: 'e',
                publication_status: 'PUBLISHED',
                publish_until: new Date(now.getTime() - 1000),
                is_published: true,
            },
        })
        const service = context.app.get(PublicationSweepService)
        await service.sweep()
        await service.sweep()
        expect((await context.prisma.news.findUniqueOrThrow({ where: { id: scheduled.id } })).publication_status).toBe(
            'PUBLISHED'
        )
        expect((await context.prisma.news.findUniqueOrThrow({ where: { id: expired.id } })).publication_status).toBe(
            'DRAFT'
        )
    })
})
