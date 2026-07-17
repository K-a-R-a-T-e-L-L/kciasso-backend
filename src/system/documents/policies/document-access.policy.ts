import { ForbiddenException, Injectable } from '@nestjs/common'
import { DocumentGroup, DocumentsAccessMode } from '@prisma/client'

import { getDocumentSection } from '../documents.constants'

export type DocumentActor = {
    is_super_admin: boolean
    documents_access_mode: DocumentsAccessMode
    document_groups: DocumentGroup[]
}

const GROUPS: Record<string, DocumentGroup> = {
    'gia-9': DocumentGroup.GIA_9,
    'gia-11': DocumentGroup.GIA_11,
    gia: DocumentGroup.GIA,
    quality: DocumentGroup.QUALITY,
    regional: DocumentGroup.REGIONAL,
    about: DocumentGroup.ABOUT,
}

@Injectable()
export class DocumentAccessPolicy {
    canAccessPlacement(actor: DocumentActor, sectionKey: string): boolean {
        if (actor.is_super_admin || actor.documents_access_mode === DocumentsAccessMode.ALL) return true
        if (actor.documents_access_mode !== DocumentsAccessMode.SELECTED_GROUPS || actor.document_groups.length === 0)
            return false
        const group = getDocumentSection(sectionKey)?.group
        return Boolean(group && actor.document_groups.includes(GROUPS[group]))
    }

    assertPlacementAccess(actor: DocumentActor, sectionKey: string): void {
        if (!this.canAccessPlacement(actor, sectionKey))
            throw new ForbiddenException('Document group access is required')
    }

    canManagePlacements(actor: DocumentActor, placements: Array<{ section_key: string }>): boolean {
        return (
            placements.length > 0 &&
            placements.every(placement => this.canAccessPlacement(actor, placement.section_key))
        )
    }

    assertCanManage(actor: DocumentActor, placements: Array<{ section_key: string }>): void {
        if (!this.canManagePlacements(actor, placements))
            throw new ForbiddenException('Mixed-scope document is read-only')
    }

    filterPlacements<T extends { section_key: string }>(actor: DocumentActor, placements: T[]): T[] {
        return placements.filter(placement => this.canAccessPlacement(actor, placement.section_key))
    }
}
