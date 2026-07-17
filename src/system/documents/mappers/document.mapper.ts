import { Prisma } from '@prisma/client'

import { DocumentVersionDto } from '../dto/document-version.dto'
import { DocumentDto } from '../dto/document.dto'
import { PublicDocumentDto } from '../dto/public-document.dto'

export type DocumentWithRelations = Prisma.DocumentGetPayload<{
    include: { current_version: true; placements: true; _count: { select: { versions: true } } }
}>

export type VersionLike = {
    id: number
    version_number: number
    original_filename: string
    extension: string
    mime_type: string
    size_bytes: bigint
    sha256: string
    created_at: Date
    current_for?: { id: number } | null
}

export function mapDocumentToDto(document: DocumentWithRelations, canManage = true): DocumentDto {
    return {
        id: document.id,
        title: document.title,
        description: document.description,
        documentNumber: document.document_number,
        documentDate: document.document_date,
        status: document.status,
        placements: document.placements
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
            .map(placement => ({
                id: placement.id,
                sectionKey: placement.section_key,
                sortOrder: placement.sort_order,
                createdAt: placement.created_at,
                updatedAt: placement.updated_at,
            })),
        currentVersion: document.current_version ? mapVersionToDto(document.current_version, true) : null,
        versionsCount: document._count.versions,
        canManage,
        createdAt: document.created_at,
        updatedAt: document.updated_at,
    }
}

export function mapVersionToDto(version: VersionLike, isCurrent: boolean): DocumentVersionDto {
    return {
        id: version.id,
        versionNumber: version.version_number,
        originalFilename: version.original_filename,
        extension: version.extension,
        mimeType: version.mime_type,
        sizeBytes: version.size_bytes.toString(),
        sha256: version.sha256,
        createdAt: version.created_at,
        isCurrent,
    }
}

export function mapPublicDocumentToDto(document: DocumentWithRelations): PublicDocumentDto | null {
    const version = document.current_version
    if (!version) return null

    return {
        id: document.id,
        title: document.title,
        description: document.description,
        documentNumber: document.document_number,
        documentDate: document.document_date,
        updatedAt: document.updated_at,
        currentVersion: {
            originalFilename: version.original_filename,
            extension: version.extension,
            mimeType: version.mime_type,
            sizeBytes: version.size_bytes.toString(),
        },
    }
}
