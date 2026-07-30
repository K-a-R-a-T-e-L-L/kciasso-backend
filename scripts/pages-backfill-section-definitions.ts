import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

import { PagesBackfillService } from '../src/system/pages/pages-backfill.service'

const prisma = new PrismaClient()

async function main() {
    const args = process.argv.slice(2)
    if (args.length !== 1 || !['--dry-run', '--apply'].includes(args[0]))
        throw new Error('Use exactly one mode: --dry-run or --apply')
    const mode = args[0] === '--apply' ? 'apply' : 'dry-run'
    const report = await new PagesBackfillService(prisma).run(mode)
    console.log(JSON.stringify(report, null, 2))
    if (report.conflicts.some(conflict => conflict.severity === 'BLOCKING')) process.exitCode = 1
}

main()
    .catch(error => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
