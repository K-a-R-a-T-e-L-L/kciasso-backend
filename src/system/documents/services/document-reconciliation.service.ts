import { Injectable } from '@nestjs/common'
import { DocumentStatus } from '@prisma/client'

import { PrismaService } from '../../../prisma/prisma.service'
import { DocumentStorage } from '../storage/document-storage'

export type DocumentReconciliationSummary = {
    missingPhysicalFiles: number
    unreferencedPhysicalFiles: number
    oldTempFiles: number
    shareLinksMissingPhysicalFiles: number
    activeShareLinks: number
    expiredShareLinks: number
    revokedShareLinks: number
    dryRun: true
}

@Injectable()
export class DocumentReconciliationService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: DocumentStorage
    ) {}

    async inspect(tempOlderThanMs = 24 * 60 * 60 * 1000): Promise<DocumentReconciliationSummary> {
        const versions = await this.prisma.documentVersion.findMany({ select: { storage_key: true } })
        const referenced = new Set(versions.map(version => version.storage_key))
        const physicalKeys = await this.storage.listStorageKeys()
        let missingPhysicalFiles = 0
        for (const key of referenced) {
            if (!(await this.storage.exists(key))) missingPhysicalFiles += 1
        }

        const now = new Date()
        const shareLinks = await this.prisma.documentShareLink.findMany({
            select: {
                revoked_at: true,
                expires_at: true,
                document_version: {
                    select: {
                        storage_key: true,
                        document: { select: { deleted_at: true, status: true } },
                    },
                },
            },
        })
        let shareLinksMissingPhysicalFiles = 0
        let activeShareLinks = 0
        let expiredShareLinks = 0
        let revokedShareLinks = 0
        for (const link of shareLinks) {
            if (!(await this.storage.exists(link.document_version.storage_key))) shareLinksMissingPhysicalFiles += 1
            if (link.revoked_at) {
                revokedShareLinks += 1
            } else if (link.expires_at && link.expires_at <= now) {
                expiredShareLinks += 1
            } else if (
                !link.document_version.document.deleted_at &&
                link.document_version.document.status !== DocumentStatus.ARCHIVED
            ) {
                activeShareLinks += 1
            }
        }

        return {
            missingPhysicalFiles,
            unreferencedPhysicalFiles: physicalKeys.filter(key => !referenced.has(key)).length,
            oldTempFiles: await this.storage.listTempFiles(new Date(Date.now() - tempOlderThanMs)),
            shareLinksMissingPhysicalFiles,
            activeShareLinks,
            expiredShareLinks,
            revokedShareLinks,
            dryRun: true,
        }
    }
}
