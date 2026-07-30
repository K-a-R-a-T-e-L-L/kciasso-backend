import { SectionDefinitionType } from '@prisma/client'

export enum PagesBackfillConflictCode {
    INVALID_PAGE_KEY = 'INVALID_PAGE_KEY',
    SYSTEM_DEFINITION_MISMATCH = 'SYSTEM_DEFINITION_MISMATCH',
    LEGACY_DEFINITION_KEY_COLLISION = 'LEGACY_DEFINITION_KEY_COLLISION',
    ORDER_COLLISION = 'ORDER_COLLISION',
    MISSING_LEGACY_HTML = 'MISSING_LEGACY_HTML',
}

export type PagesBackfillConflictSeverity = 'WARNING' | 'BLOCKING'

export interface PagesBackfillConflict {
    code: PagesBackfillConflictCode
    severity: PagesBackfillConflictSeverity
    legacyTable: 'page_sections' | 'global_html_sections' | 'registry'
    legacyId: number | null
    pageKey: string | null
    message: string
}

export interface PagesBackfillReport {
    mode: 'dry-run' | 'apply'
    applied: boolean
    definitionsCreated: number
    definitionsUpdated: number
    placementsCreated: number
    placementsUpdated: number
    layoutsCreated: number
    layoutsRevisionIncremented: number
    conflicts: PagesBackfillConflict[]
}

export interface PagesBackfillDefinitionValues {
    key: string
    type: SectionDefinitionType
    name: string
    description: string | null
    systemRendererKey: string | null
    html: string | null
    css: string | null
    javascript: string | null
    iframeHeight: number | null
    ownerPageKey: string | null
}

export interface PagesBackfillPlan {
    conflicts: PagesBackfillConflict[]
    layoutsToCreate: string[]
    definitionsToCreate: PagesBackfillDefinitionValues[]
    definitionsToUpdate: Array<PagesBackfillDefinitionValues & { id: number }>
    placementsToCreate: Array<{
        pageKey: string
        definitionKey: string
        sortOrder: number
        isVisible: boolean
    }>
    placementsToUpdate: Array<never>
    revisionPageKeys: string[]
}
