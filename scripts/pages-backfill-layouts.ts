import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PAGE_REGISTRY } from '../src/system/pages/pages.registry'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')
const report = process.argv.find(x => x.startsWith('--report='))?.slice('--report='.length)

async function main() {
    const result: Array<{ pageKey: string; sections: number; action: string }> = []
    for (const page of PAGE_REGISTRY) {
        const existing = await prisma.pageLayout.findUnique({
            where: { page_key: page.pageKey },
            include: { sections: { where: { deleted_at: null } } },
        })
        if (!apply) {
            result.push({
                pageKey: page.pageKey,
                sections: existing?.sections.length ?? page.systemSections.length,
                action: existing ? 'exists' : 'would-create',
            })
            continue
        }
        const layout = await prisma.pageLayout.upsert({
            where: { page_key: page.pageKey },
            create: { page_key: page.pageKey },
            update: {},
        })
        for (const [sort_order, definition] of page.systemSections.entries()) {
            const section = await prisma.pageSection.findFirst({
                where: { page_layout_id: layout.id, system_key: definition.key, deleted_at: null },
            })
            if (!section)
                await prisma.pageSection.create({
                    data: {
                        page_layout_id: layout.id,
                        type: 'SYSTEM',
                        system_key: definition.key,
                        internal_name: definition.name,
                        sort_order,
                    },
                })
        }
        result.push({
            pageKey: page.pageKey,
            sections: page.systemSections.length,
            action: existing ? 'updated' : 'created',
        })
    }
    const text = JSON.stringify({ apply, pages: result }, null, 2)
    if (report) require('node:fs').writeFileSync(report, text, 'utf8')
    console.log(text)
}
main().finally(() => prisma.$disconnect())
