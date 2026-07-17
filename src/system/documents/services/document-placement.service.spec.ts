import { Prisma } from '@prisma/client'

import { DocumentPlacementService } from './document-placement.service'
import { ErrorCodeEnum } from '../../../_helpers/enums/validator/error.code.enum'

describe('DocumentPlacementService', () => {
    const currentPlacements = [
        { id: 11, document_id: 7, section_key: 'gia-9.results', sort_order: 4 },
        { id: 12, document_id: 7, section_key: 'gia-11.results', sort_order: 2 },
    ]
    const deleted: number[] = []
    const created: Array<Record<string, unknown>> = []
    const updated: Array<Record<string, unknown>> = []
    const transaction = {
        documentPlacement: {
            findMany: jest.fn().mockResolvedValue(currentPlacements),
            delete: jest.fn(async ({ where }: { where: { id: number } }) => deleted.push(where.id)),
            aggregate: jest.fn().mockResolvedValue({ _max: { sort_order: 8 } }),
            create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => created.push(data)),
            updateMany: jest.fn(
                async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
                    updated.push({ where, data })
                    return { count: 1 }
                }
            ),
        },
        document: {
            update: jest.fn(),
        },
    } as unknown as Prisma.TransactionClient
    const prisma = {
        $transaction: jest.fn(async (callback: (tx: Prisma.TransactionClient) => unknown) => callback(transaction)),
        documentPlacement: {
            findMany: jest.fn(),
        },
    }
    let service: DocumentPlacementService

    beforeEach(() => {
        jest.clearAllMocks()
        deleted.length = 0
        created.length = 0
        updated.length = 0
        service = new DocumentPlacementService(prisma as never)
    })

    it('accepts fixed registry keys and rejects empty, duplicate and unknown keys', () => {
        expect(service.validatePlacementKeys(['gia-9.results', 'about.obuchenie']).map(item => item.key)).toEqual([
            'gia-9.results',
            'about.obuchenie',
        ])
        expect(() => service.validatePlacementKeys([])).toThrow()
        expect(() => service.validatePlacementKeys(['gia-9.results', 'gia-9.results'])).toThrow()
        try {
            service.validatePlacementKeys(['not-a-fixed-placement'])
        } catch (error) {
            expect((error as { getResponse: () => { errorMessage: string } }).getResponse().errorMessage).toBe(
                ErrorCodeEnum.DOCUMENT_SECTION_NOT_FOUND
            )
        }
    })

    it('creates initial placements in one caller-owned transaction', async () => {
        await service.createInitialPlacements(transaction, 7, service.validatePlacementKeys(['gia-9.results']))

        expect(transaction.documentPlacement.create).toHaveBeenCalledWith({
            data: { document_id: 7, section_key: 'gia-9.results', sort_order: 9 },
        })
    })

    it('replaces the exact set without touching versions or deleting the document', async () => {
        await service.replacePlacements(7, ['gia-9.results', 'regionalnyy-proekt'])

        expect(deleted).toEqual([12])
        expect(created).toEqual([{ document_id: 7, section_key: 'regionalnyy-proekt', sort_order: 9 }])
        expect(transaction.document.update).toHaveBeenCalledWith({
            where: { id: 7 },
            data: { section_key: 'gia-9.results', updated_at: expect.any(Date) },
        })
    })

    it('reorders a complete placement list and rejects missing, duplicate and foreign IDs', async () => {
        prisma.documentPlacement.findMany.mockResolvedValue([
            { document_id: 7 },
            { document_id: 8 },
            { document_id: 9 },
        ])

        await expect(
            service.reorderPlacements({
                sectionKey: 'gia-9.results',
                orderedDocumentIds: [9, 7, 8],
            })
        ).resolves.toEqual({ sectionKey: 'gia-9.results', documentCount: 3 })
        expect(updated.map(item => item.where)).toEqual([
            { document_id: 9, section_key: 'gia-9.results' },
            { document_id: 7, section_key: 'gia-9.results' },
            { document_id: 8, section_key: 'gia-9.results' },
        ])

        await expect(
            service.reorderPlacements({ sectionKey: 'gia-9.results', orderedDocumentIds: [7, 8] })
        ).rejects.toThrow()
        await expect(
            service.reorderPlacements({ sectionKey: 'gia-9.results', orderedDocumentIds: [7, 7, 9] })
        ).rejects.toThrow()
        await expect(
            service.reorderPlacements({ sectionKey: 'gia-9.results', orderedDocumentIds: [7, 8, 10] })
        ).rejects.toThrow()
    })

    it('keeps sort order independent for each fixed placement', async () => {
        prisma.documentPlacement.findMany.mockResolvedValue([{ document_id: 7 }, { document_id: 8 }])

        await service.reorderPlacements({ sectionKey: 'gia-9.results', orderedDocumentIds: [8, 7] })
        await service.reorderPlacements({ sectionKey: 'gia-11.results', orderedDocumentIds: [7, 8] })

        expect((updated[0].where as { section_key: string }).section_key).toBe('gia-9.results')
        expect((updated[1].where as { section_key: string }).section_key).toBe('gia-9.results')
        expect((updated[2].where as { section_key: string }).section_key).toBe('gia-11.results')
        expect((updated[3].where as { section_key: string }).section_key).toBe('gia-11.results')
    })
})
