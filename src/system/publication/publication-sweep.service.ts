import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class PublicationSweepService {
    private readonly logger = new Logger(PublicationSweepService.name)
    constructor(private readonly prisma: PrismaService) {}

    @Cron(CronExpression.EVERY_MINUTE)
    async sweep() {
        await this.runWithLock()
    }

    async onApplicationBootstrap() {
        await this.runWithLock()
    }

    private async runWithLock() {
        const result = await this.prisma.$transaction(async tx => {
            const locked = await tx.$queryRaw<
                Array<{ acquired: boolean }>
            >`SELECT pg_try_advisory_xact_lock(8138001) AS acquired`
            if (!locked[0]?.acquired)
                return { newsActivated: 0, newsExpired: 0, placementsActivated: 0, placementsExpired: 0 }
            const now = new Date()
            const newsExpired = await tx.news.updateMany({
                where: { publication_status: { in: ['PUBLISHED', 'SCHEDULED'] }, publish_until: { lte: now } },
                data: {
                    publication_status: 'DRAFT',
                    is_published: false,
                    publish_until: null,
                    publication_revision: { increment: 1 },
                },
            })
            const newsActivated = await tx.news.updateMany({
                where: {
                    publication_status: 'SCHEDULED',
                    publish_from: { lte: now },
                    OR: [{ publish_until: null }, { publish_until: { gt: now } }],
                },
                data: { publication_status: 'PUBLISHED', is_published: true, publication_revision: { increment: 1 } },
            })
            const placementsExpired = await tx.documentPlacement.updateMany({
                where: { publication_status: { in: ['PUBLISHED', 'SCHEDULED'] }, publish_until: { lte: now } },
                data: { publication_status: 'DRAFT', publish_until: null, publication_revision: { increment: 1 } },
            })
            const placementsActivated = await tx.documentPlacement.updateMany({
                where: {
                    publication_status: 'SCHEDULED',
                    publish_from: { lte: now },
                    OR: [{ publish_until: null }, { publish_until: { gt: now } }],
                },
                data: { publication_status: 'PUBLISHED', publication_revision: { increment: 1 } },
            })
            return {
                newsActivated: newsActivated.count,
                newsExpired: newsExpired.count,
                placementsActivated: placementsActivated.count,
                placementsExpired: placementsExpired.count,
            }
        })
        if (Object.values(result).some(value => value > 0)) this.logger.log(JSON.stringify(result))
    }
}
