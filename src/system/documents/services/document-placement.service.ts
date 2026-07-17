import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { ErrorCodeEnum } from '../../../_helpers/enums/validator/error.code.enum'
import { ErrorDto } from '../../../_helpers/errors/error.dto'
import { PrismaService } from '../../../prisma/prisma.service'
import { DOCUMENT_PERMISSION, DocumentSectionMetadata, getDocumentSection } from '../documents.constants'
import { ReorderDocumentPlacementsDto } from '../dto/reorder-document-placements.dto'

@Injectable()
export class DocumentPlacementService {
    constructor(private readonly prisma: PrismaService) {}

    getSectionOrThrow(sectionKey: string): DocumentSectionMetadata {
        const section = typeof sectionKey === 'string' ? getDocumentSection(sectionKey) : undefined
        if (!section || section.permissionKey !== DOCUMENT_PERMISSION) {
            throw new NotFoundException(
                new ErrorDto(ErrorCodeEnum.DOCUMENT_SECTION_NOT_FOUND, 'Not Found', 404, 'Unknown document section')
            )
        }
        return section
    }

    validatePlacementKeys(keys: string[]): DocumentSectionMetadata[] {
        if (!Array.isArray(keys) || keys.length === 0 || new Set(keys).size !== keys.length) {
            throw new BadRequestException(
                new ErrorDto(
                    ErrorCodeEnum.DOCUMENT_SECTION_NOT_FOUND,
                    'Bad Request',
                    400,
                    'At least one unique placement is required'
                )
            )
        }
        return keys.map(key => this.getSectionOrThrow(key))
    }

    async createInitialPlacements(
        transaction: Prisma.TransactionClient,
        documentId: number,
        sections: readonly DocumentSectionMetadata[]
    ): Promise<void> {
        for (const placement of sections) {
            const tail = await transaction.documentPlacement.aggregate({
                where: { section_key: placement.key },
                _max: { sort_order: true },
            })
            await transaction.documentPlacement.create({
                data: {
                    document_id: documentId,
                    section_key: placement.key,
                    sort_order: (tail._max.sort_order ?? -1) + 1,
                },
            })
        }
    }

    async replacePlacements(documentId: number, placementKeys: string[]): Promise<void> {
        const sections = this.validatePlacementKeys(placementKeys)
        await this.prisma.$transaction(async transaction => {
            const current = await transaction.documentPlacement.findMany({ where: { document_id: documentId } })
            const wanted = new Set(sections.map(item => item.key))
            for (const placement of current) {
                if (!wanted.has(placement.section_key)) {
                    await transaction.documentPlacement.delete({ where: { id: placement.id } })
                }
            }
            for (const section of sections) {
                if (current.some(item => item.section_key === section.key)) continue
                const tail = await transaction.documentPlacement.aggregate({
                    where: { section_key: section.key },
                    _max: { sort_order: true },
                })
                await transaction.documentPlacement.create({
                    data: {
                        document_id: documentId,
                        section_key: section.key,
                        sort_order: (tail._max.sort_order ?? -1) + 1,
                    },
                })
            }
            await transaction.document.update({
                where: { id: documentId },
                data: { section_key: sections[0].key, updated_at: new Date() },
            })
        })
    }

    async reorderPlacements(dto: ReorderDocumentPlacementsDto): Promise<{ sectionKey: string; documentCount: number }> {
        const section = this.getSectionOrThrow(dto.sectionKey)
        const placements = await this.prisma.documentPlacement.findMany({
            where: { section_key: section.key, document: { deleted_at: null } },
            select: { document_id: true },
        })
        const expected = new Set(placements.map(item => item.document_id))
        const actual = new Set(dto.orderedDocumentIds)
        if (
            dto.orderedDocumentIds.length !== actual.size ||
            expected.size !== actual.size ||
            [...expected].some(id => !actual.has(id))
        ) {
            throw new BadRequestException(
                new ErrorDto(
                    ErrorCodeEnum.DOCUMENT_REORDER_INVALID,
                    'Bad Request',
                    400,
                    'Full document order is required'
                )
            )
        }

        await this.prisma.$transaction(async transaction => {
            for (const [index, id] of dto.orderedDocumentIds.entries()) {
                await transaction.documentPlacement.updateMany({
                    where: { document_id: id, section_key: section.key },
                    data: { sort_order: index },
                })
            }
        })
        return { sectionKey: section.key, documentCount: dto.orderedDocumentIds.length }
    }
}
