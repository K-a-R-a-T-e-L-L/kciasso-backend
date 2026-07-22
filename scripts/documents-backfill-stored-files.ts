import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')
const reportPath = process.argv.find(value => value.startsWith('--report='))?.slice('--report='.length)

async function main() {
    const root = process.env.DOCUMENT_STORAGE_ROOT ?? './storage/documents'
    const versions = await prisma.documentVersion.findMany({ orderBy: { id: 'asc' } })
    const bySha = new Map<string, typeof versions>()
    for (const version of versions) bySha.set(version.sha256, [...(bySha.get(version.sha256) ?? []), version])
    const report: Array<Record<string, unknown>> = []
    for (const [sha256, group] of bySha) {
        const existing = await prisma.storedFile.findUnique({ where: { sha256 } })
        const survivor = group.find(version => existsSync(join(root, version.storage_key)))
        report.push({
            sha256,
            versions: group.length,
            existingStoredFileId: existing?.id ?? null,
            survivingStorageKey: survivor?.storage_key ?? null,
            missingAllCopies: !survivor,
        })
        if (apply && survivor && !existing) {
            const stored = await prisma.storedFile.create({
                data: {
                    sha256,
                    storage_key: survivor.storage_key,
                    extension: survivor.extension,
                    mime_type: survivor.mime_type,
                    size_bytes: survivor.size_bytes,
                },
            })
            await prisma.documentVersion.updateMany({ where: { sha256 }, data: { stored_file_id: stored.id } })
        } else if (apply && existing) {
            await prisma.documentVersion.updateMany({
                where: { sha256, stored_file_id: null },
                data: { stored_file_id: existing.id },
            })
        }
    }
    const output = JSON.stringify(
        { apply, groups: report.length, missingAllCopies: report.filter(item => item.missingAllCopies).length, report },
        null,
        2
    )
    if (reportPath) writeFileSync(reportPath, output, 'utf8')
    else console.log(output)
}

main().finally(() => prisma.$disconnect())
