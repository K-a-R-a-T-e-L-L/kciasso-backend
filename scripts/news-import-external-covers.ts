import 'dotenv/config'
import { ConfigService } from '@nestjs/config'
import { PrismaClient } from '@prisma/client'
import { NewsMediaDispatcherFactory, NewsMediaDnsResolver, NewsMediaRemoteFetcher, NewsMediaService } from '../src/system/news/media/news-media.service'

const prisma = new PrismaClient()
const config = new ConfigService(process.env)
const media = new NewsMediaService(config, prisma as any, new NewsMediaRemoteFetcher(config, new NewsMediaDnsResolver(), new NewsMediaDispatcherFactory()))
const apply = process.argv.includes('--apply')
const limitArg = process.argv.find(value => value.startsWith('--limit='))?.slice(8)
const limit = limitArg ? Math.max(1, Number(limitArg)) : 100
const reportPath = process.argv.find(value => value.startsWith('--report='))?.slice(9)

async function main() {
    await media.onModuleInit()
    const items = await prisma.news.findMany({ where: { deleted_at: null, cover_image_url: { not: null } }, orderBy: { id: 'asc' }, take: limit })
    const rows: Array<Record<string, unknown>> = []
    for (const item of items) {
        if (!item.cover_image_url || media.keyFromOwnedUrl(item.cover_image_url)) continue
        const row: Record<string, unknown> = { id: item.id, url: item.cover_image_url, status: 'pending' }
        if (apply) {
            try {
                const imported = await media.importFromUrl(item.cover_image_url)
                await prisma.news.update({ where: { id: item.id }, data: { cover_image_url: imported.url, cover_media_id: imported.mediaId } })
                row.status = 'imported'; row.mediaId = imported.mediaId
            } catch (error) { row.status = 'failed'; row.error = error instanceof Error ? error.message : 'unknown error' }
        } else {
            try {
                await media.probeImportUrl(item.cover_image_url)
                row.status = 'would-import'
            } catch (error) {
                row.status = 'would-fail'
                row.error = error instanceof Error ? error.message : 'unknown error'
            }
        }
        rows.push(row)
    }
    const output = JSON.stringify({ apply, limit, rows }, null, 2)
    if (reportPath) require('node:fs').writeFileSync(reportPath, output, 'utf8')
    console.log(output)
}
main().finally(() => prisma.$disconnect())
