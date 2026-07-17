import { DocumentStatus } from '@prisma/client'

import { mapDocumentToDto, mapPublicDocumentToDto, mapVersionToDto } from './document.mapper'

describe('document mapper', () => {
    const version = {
        id: 7,
        version_number: 2,
        original_filename: 'report.pdf',
        extension: 'pdf',
        mime_type: 'application/pdf',
        size_bytes: BigInt(123),
        sha256: 'a'.repeat(64),
        created_at: new Date('2026-01-02T00:00:00.000Z'),
        current_for: { id: 4 },
    }

    const document = {
        id: 4,
        title: 'Report',
        description: null,
        document_number: '12',
        document_date: new Date('2026-01-01T00:00:00.000Z'),
        status: DocumentStatus.PUBLISHED,
        current_version_id: 7,
        created_by_id: 1,
        updated_by_id: 1,
        created_at: new Date('2025-12-01T00:00:00.000Z'),
        updated_at: new Date('2026-01-03T00:00:00.000Z'),
        deleted_at: null,
        current_version: version,
        placements: [
            {
                id: 2,
                document_id: 4,
                section_key: 'gia-9-results',
                sort_order: 2,
                created_at: new Date('2025-12-02T00:00:00.000Z'),
                updated_at: new Date('2025-12-03T00:00:00.000Z'),
            },
            {
                id: 1,
                document_id: 4,
                section_key: 'gia-9',
                sort_order: 1,
                created_at: new Date('2025-12-01T00:00:00.000Z'),
                updated_at: new Date('2025-12-02T00:00:00.000Z'),
            },
        ],
        _count: { versions: 2 },
    }

    it('maps the admin document and sorts placements without exposing storage fields', () => {
        const result = mapDocumentToDto(document as never)

        expect(result.placements.map(item => item.sectionKey)).toEqual(['gia-9', 'gia-9-results'])
        expect(result.currentVersion?.sizeBytes).toBe('123')
        expect(result).not.toHaveProperty('storageKey')
        expect(result.currentVersion).not.toHaveProperty('storageKey')
    })

    it('maps a version and current flag, including bigint size as a string', () => {
        expect(mapVersionToDto(version as never, true)).toEqual({
            id: 7,
            versionNumber: 2,
            originalFilename: 'report.pdf',
            extension: 'pdf',
            mimeType: 'application/pdf',
            sizeBytes: '123',
            sha256: 'a'.repeat(64),
            createdAt: version.created_at,
            isCurrent: true,
        })
    })

    it('maps public documents without internal version fields', () => {
        const result = mapPublicDocumentToDto(document as never)

        expect(result?.currentVersion).toEqual({
            originalFilename: 'report.pdf',
            extension: 'pdf',
            mimeType: 'application/pdf',
            sizeBytes: '123',
        })
        expect(result).not.toHaveProperty('status')
        expect(result).not.toHaveProperty('placements')
        expect(result?.currentVersion).not.toHaveProperty('versionNumber')
        expect(result?.currentVersion).not.toHaveProperty('sha256')
    })

    it('returns no public DTO when a document has no current version', () => {
        expect(mapPublicDocumentToDto({ ...document, current_version: null } as never)).toBeNull()
    })
})
