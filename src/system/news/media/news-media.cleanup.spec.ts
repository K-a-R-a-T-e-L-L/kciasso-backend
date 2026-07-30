import { ConfigService } from '@nestjs/config'

import {
    NewsMediaDispatcherFactory,
    NewsMediaDnsResolver,
    NewsMediaRemoteFetcher,
    NewsMediaService,
} from './news-media.service'

describe('NewsMediaService cleanupPending', () => {
    it('quarantines and removes old unattached media, while leaving referenced media', async () => {
        const prisma = {
            newsMedia: {
                findMany: jest.fn().mockResolvedValue([{ id: 1, storage_key: `${'a'.repeat(64)}.png` }]),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                findFirst: jest.fn().mockResolvedValue(null),
                deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
        }
        const config = new ConfigService({
            NEWS_MEDIA_ROOT: 'C:/Temp/kciasso-test-media',
            NEWS_MEDIA_PENDING_TTL_HOURS: 24,
        })
        const service = new NewsMediaService(
            config,
            prisma as any,
            new NewsMediaRemoteFetcher(config, new NewsMediaDnsResolver(), new NewsMediaDispatcherFactory())
        )
        const result = await service.cleanupPending(new Date('2026-07-23T00:00:00.000Z'))
        expect(result).toEqual({ candidates: 1, quarantined: 1, deleted: 1, skipped: 0 })
        expect(prisma.newsMedia.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ data: { quarantined_at: new Date('2026-07-23T00:00:00.000Z') } })
        )
        expect(prisma.newsMedia.deleteMany).toHaveBeenCalled()
    })

    it('atomically removes an unreferenced media row before deleting its blob', async () => {
        const prisma = {
            newsMedia: {
                deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
        }
        const config = new ConfigService({ NEWS_MEDIA_ROOT: 'C:/Temp/kciasso-test-media' })
        const service = new NewsMediaService(
            config,
            prisma as any,
            new NewsMediaRemoteFetcher(config, new NewsMediaDnsResolver(), new NewsMediaDispatcherFactory())
        )
        const key = `${'b'.repeat(64)}.png`

        await expect(service.deleteIfUnreferenced(key)).resolves.toBe(true)
        expect(prisma.newsMedia.deleteMany).toHaveBeenCalledWith({
            where: { storage_key: key, news: { none: { deleted_at: null } } },
        })
    })
})
