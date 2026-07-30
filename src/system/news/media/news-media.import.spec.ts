import { ConfigService } from '@nestjs/config'

import { NewsMediaService } from './news-media.service'

describe('NewsMediaService import metadata', () => {
    it('persists the legacy source URL as internal media metadata', async () => {
        const prisma = {
            newsMedia: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({
                    id: 7,
                    storage_key: `${'a'.repeat(64)}.png`,
                    status: 'READY',
                }),
            },
        }
        const remote = {
            fetch: jest.fn().mockResolvedValue({
                originalname: 'remote.png',
                mimetype: 'image/png',
                size: 8,
                buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            }),
        }
        const service = new NewsMediaService(
            new ConfigService({ NEWS_MEDIA_ROOT: 'C:/Temp/kciasso-test-media' }),
            prisma as any,
            remote as any
        )

        await service.importFromUrl('http://controlled.kciasso.test/valid.png')

        expect(prisma.newsMedia.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    source_url: 'http://controlled.kciasso.test/valid.png',
                    imported_at: expect.any(Date),
                }),
            })
        )
    })
})
