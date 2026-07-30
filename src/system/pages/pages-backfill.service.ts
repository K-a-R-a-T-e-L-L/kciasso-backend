import {
    GlobalHtmlSection,
    GlobalHtmlSlot,
    PageSection,
    Prisma,
    PrismaClient,
    SectionDefinition,
    SectionDefinitionType,
} from '@prisma/client'

import {
    PagesBackfillConflict,
    PagesBackfillConflictCode,
    PagesBackfillDefinitionValues,
    PagesBackfillPlan,
    PagesBackfillReport,
} from './pages-backfill.types'
import { PAGE_REGISTRY } from './pages.registry'

const GLOBAL_CONTACTS_KEY = 'global.contacts'
const SLOT_ORDER: Record<GlobalHtmlSlot, number> = {
    AFTER_HEADER: 0,
    BEFORE_CONTENT: 1,
    AFTER_CONTENT: 2,
    BEFORE_CONTACTS: 3,
    AFTER_CONTACTS: 4,
    BEFORE_FOOTER: 5,
}

type DesiredPlacement = {
    definitionKey: string
    sourceOrder: number
    sourceId: number
    isVisible: boolean
}

export class PagesBackfillService {
    constructor(private readonly prisma: PrismaClient) {}

    async analyze(): Promise<PagesBackfillPlan> {
        const conflicts: PagesBackfillConflict[] = []
        const layouts = await this.prisma.pageLayout.findMany({
            include: {
                sections: { where: { deleted_at: null }, orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] },
                placements: { include: { section_definition: true }, orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] },
            },
        })
        const definitions = await this.prisma.sectionDefinition.findMany()
        const legacyGlobals = await this.prisma.globalHtmlSection.findMany({
            orderBy: [{ slot: 'asc' }, { sort_order: 'asc' }, { id: 'asc' }],
        })

        const registryKeys = PAGE_REGISTRY.map(page => page.pageKey)
        const registryKeySet = new Set(registryKeys)
        this.validateRegistry(conflicts)
        for (const layout of layouts) {
            if (!registryKeySet.has(layout.page_key)) {
                conflicts.push({
                    code: PagesBackfillConflictCode.INVALID_PAGE_KEY,
                    severity: 'BLOCKING',
                    legacyTable: 'registry',
                    legacyId: layout.id,
                    pageKey: layout.page_key,
                    message: `Legacy page layout ${layout.id} has unknown page key ${layout.page_key}`,
                })
            }
        }

        const layoutByKey = new Map(layouts.map(layout => [layout.page_key, layout]))
        const definitionByKey = new Map(
            definitions.filter(definition => definition.key !== null).map(definition => [definition.key!, definition])
        )
        const definitionsToCreate: PagesBackfillDefinitionValues[] = []
        const definitionsToUpdate: Array<PagesBackfillDefinitionValues & { id: number }> = []
        const desiredByPage = new Map<string, DesiredPlacement[]>()

        const registerDefinition = (
            values: PagesBackfillDefinitionValues,
            legacyTable: PagesBackfillConflict['legacyTable'],
            legacyId: number | null,
            collision: (existing: SectionDefinition) => boolean,
            collisionCode: PagesBackfillConflictCode
        ) => {
            const existing = definitionByKey.get(values.key)
            if (!existing) {
                definitionsToCreate.push(values)
                return
            }
            if (collision(existing)) {
                conflicts.push({
                    code: collisionCode,
                    severity: 'BLOCKING',
                    legacyTable,
                    legacyId,
                    pageKey: values.ownerPageKey,
                    message: `Definition key ${values.key} is already owned by an incompatible definition`,
                })
                return
            }
            if (this.definitionChanged(existing, values)) definitionsToUpdate.push({ ...values, id: existing.id })
        }

        for (const page of PAGE_REGISTRY) {
            const layout = layoutByKey.get(page.pageKey)
            const legacyRows = layout?.sections ?? []
            this.reportPageOrderCollisions(conflicts, page.pageKey, legacyRows)
            const desired: DesiredPlacement[] = []

            for (const [index, system] of page.systemSections.entries()) {
                const legacy = legacyRows.find(row => row.type === 'SYSTEM' && row.system_key === system.key)
                const values = this.definitionValues({
                    key: system.key,
                    type: SectionDefinitionType.PAGE_SYSTEM,
                    name: system.name,
                    systemRendererKey: system.systemRendererKey,
                    ownerPageKey: page.pageKey,
                })
                registerDefinition(
                    values,
                    'registry',
                    null,
                    existing =>
                        existing.type !== SectionDefinitionType.PAGE_SYSTEM ||
                        existing.owner_page_key !== page.pageKey ||
                        existing.system_renderer_key !== system.systemRendererKey,
                    PagesBackfillConflictCode.SYSTEM_DEFINITION_MISMATCH
                )
                desired.push({
                    definitionKey: system.key,
                    sourceOrder: legacy?.sort_order ?? index,
                    sourceId: legacy?.id ?? -(page.systemSections.length - index),
                    isVisible: legacy?.is_enabled ?? true,
                })
            }

            for (const legacy of legacyRows.filter(row => row.type === 'CUSTOM_HTML')) {
                const key = `legacy.page-section.${legacy.id}`
                if (legacy.raw_html === null) {
                    conflicts.push({
                        code: PagesBackfillConflictCode.MISSING_LEGACY_HTML,
                        severity: 'WARNING',
                        legacyTable: 'page_sections',
                        legacyId: legacy.id,
                        pageKey: page.pageKey,
                        message: `Legacy page section ${legacy.id} has null HTML and will be preserved as an empty string`,
                    })
                }
                const values = this.definitionValues({
                    key,
                    type: SectionDefinitionType.PAGE_CUSTOM_HTML,
                    name: legacy.internal_name,
                    html: legacy.raw_html ?? '',
                    iframeHeight: legacy.iframe_height_px,
                    ownerPageKey: page.pageKey,
                })
                registerDefinition(
                    values,
                    'page_sections',
                    legacy.id,
                    existing =>
                        existing.type !== SectionDefinitionType.PAGE_CUSTOM_HTML ||
                        existing.owner_page_key !== page.pageKey,
                    PagesBackfillConflictCode.LEGACY_DEFINITION_KEY_COLLISION
                )
                desired.push({
                    definitionKey: key,
                    sourceOrder: legacy.sort_order,
                    sourceId: legacy.id,
                    isVisible: legacy.is_enabled,
                })
            }
            desired.sort((left, right) => left.sourceOrder - right.sourceOrder || left.sourceId - right.sourceId)
            desiredByPage.set(page.pageKey, desired)
        }

        registerDefinition(
            this.definitionValues({
                key: GLOBAL_CONTACTS_KEY,
                type: SectionDefinitionType.GLOBAL_SYSTEM,
                name: 'Контакты',
                systemRendererKey: GLOBAL_CONTACTS_KEY,
            }),
            'registry',
            null,
            existing =>
                existing.type !== SectionDefinitionType.GLOBAL_SYSTEM ||
                existing.owner_page_key !== null ||
                existing.system_renderer_key !== GLOBAL_CONTACTS_KEY,
            PagesBackfillConflictCode.SYSTEM_DEFINITION_MISMATCH
        )

        this.reportGlobalOrderCollisions(conflicts, legacyGlobals)
        const globalDesired: DesiredPlacement[] = []
        for (const legacy of legacyGlobals.sort(this.compareGlobals)) {
            const key = `legacy.global-html.${legacy.id}`
            const values = this.definitionValues({
                key,
                type: SectionDefinitionType.GLOBAL_CUSTOM_HTML,
                name: legacy.name,
                html: legacy.html,
                css: legacy.css,
                javascript: legacy.javascript,
                iframeHeight: legacy.iframe_height_px,
            })
            registerDefinition(
                values,
                'global_html_sections',
                legacy.id,
                existing =>
                    existing.type !== SectionDefinitionType.GLOBAL_CUSTOM_HTML || existing.owner_page_key !== null,
                PagesBackfillConflictCode.LEGACY_DEFINITION_KEY_COLLISION
            )
            globalDesired.push({
                definitionKey: key,
                sourceOrder: SLOT_ORDER[legacy.slot] * 1_000_000 + legacy.sort_order,
                sourceId: legacy.id,
                isVisible: legacy.is_enabled,
            })
        }

        const placementsToCreate: PagesBackfillPlan['placementsToCreate'] = []
        for (const page of PAGE_REGISTRY) {
            const layout = layoutByKey.get(page.pageKey)
            const existingKeys = new Set(
                (layout?.placements ?? [])
                    .map(placement => placement.section_definition.key)
                    .filter((key): key is string => key !== null)
            )
            const ordered = [
                ...(desiredByPage.get(page.pageKey) ?? []),
                {
                    definitionKey: GLOBAL_CONTACTS_KEY,
                    sourceOrder: Number.MAX_SAFE_INTEGER - 1,
                    sourceId: 0,
                    isVisible: true,
                },
                ...globalDesired,
            ]
            const fresh = !layout || layout.placements.length === 0
            let nextOrder = fresh ? 0 : Math.max(...layout.placements.map(placement => placement.sort_order), -1) + 1
            for (const desired of ordered) {
                if (existingKeys.has(desired.definitionKey)) continue
                placementsToCreate.push({
                    pageKey: page.pageKey,
                    definitionKey: desired.definitionKey,
                    sortOrder: nextOrder++,
                    isVisible: desired.isVisible,
                })
            }
        }

        const revisionPageKeys = new Set(placementsToCreate.map(action => action.pageKey))
        for (const definition of definitionsToUpdate) {
            if (definition.ownerPageKey) revisionPageKeys.add(definition.ownerPageKey)
            else {
                const existing = definitionByKey.get(definition.key)
                for (const layout of layouts) {
                    if (layout.placements.some(placement => placement.section_definition_id === existing?.id)) {
                        revisionPageKeys.add(layout.page_key)
                    }
                }
            }
        }

        return {
            conflicts,
            layoutsToCreate: registryKeys.filter(key => !layoutByKey.has(key)),
            definitionsToCreate,
            definitionsToUpdate,
            placementsToCreate,
            placementsToUpdate: [],
            revisionPageKeys: registryKeys.filter(key => revisionPageKeys.has(key)),
        }
    }

    async apply(plan: PagesBackfillPlan): Promise<PagesBackfillReport> {
        const report = this.report('apply', plan)
        if (plan.conflicts.some(conflict => conflict.severity === 'BLOCKING')) {
            return {
                ...report,
                definitionsCreated: 0,
                definitionsUpdated: 0,
                placementsCreated: 0,
                placementsUpdated: 0,
                layoutsCreated: 0,
                layoutsRevisionIncremented: 0,
            }
        }

        await this.prisma.$transaction(async tx => {
            for (const pageKey of plan.layoutsToCreate) await tx.pageLayout.create({ data: { page_key: pageKey } })
            for (const definition of plan.definitionsToCreate) {
                await tx.sectionDefinition.create({ data: this.definitionData(definition) })
            }
            for (const definition of plan.definitionsToUpdate) {
                await tx.sectionDefinition.update({
                    where: { id: definition.id },
                    data: this.definitionData(definition),
                })
            }

            const layouts = await tx.pageLayout.findMany({
                where: { page_key: { in: PAGE_REGISTRY.map(page => page.pageKey) } },
            })
            const definitions = await tx.sectionDefinition.findMany({
                where: { key: { in: plan.placementsToCreate.map(action => action.definitionKey) } },
            })
            const layoutByKey = new Map(layouts.map(layout => [layout.page_key, layout]))
            const definitionByKey = new Map(definitions.map(definition => [definition.key!, definition]))
            for (const placement of plan.placementsToCreate) {
                const layout = layoutByKey.get(placement.pageKey)
                const definition = definitionByKey.get(placement.definitionKey)
                if (!layout || !definition)
                    throw new Error(`BACKFILL_PLAN_REFERENCE_MISSING:${placement.pageKey}:${placement.definitionKey}`)
                await tx.pageSectionPlacement.create({
                    data: {
                        page_layout_id: layout.id,
                        page_key: placement.pageKey,
                        section_definition_id: definition.id,
                        sort_order: placement.sortOrder,
                        is_visible: placement.isVisible,
                    },
                })
            }
            for (const pageKey of plan.revisionPageKeys) {
                await tx.pageLayout.update({ where: { page_key: pageKey }, data: { revision: { increment: 1 } } })
            }
        })

        return { ...report, applied: true }
    }

    async run(mode: 'dry-run' | 'apply'): Promise<PagesBackfillReport> {
        const plan = await this.analyze()
        return mode === 'dry-run' ? this.report(mode, plan) : this.apply(plan)
    }

    private report(mode: 'dry-run' | 'apply', plan: PagesBackfillPlan): PagesBackfillReport {
        return {
            mode,
            applied: false,
            definitionsCreated: plan.definitionsToCreate.length,
            definitionsUpdated: plan.definitionsToUpdate.length,
            placementsCreated: plan.placementsToCreate.length,
            placementsUpdated: plan.placementsToUpdate.length,
            layoutsCreated: plan.layoutsToCreate.length,
            layoutsRevisionIncremented: plan.revisionPageKeys.length,
            conflicts: plan.conflicts,
        }
    }

    private validateRegistry(conflicts: PagesBackfillConflict[]) {
        const pageKeys = new Set<string>()
        const definitionKeys = new Map<string, string>()
        for (const page of PAGE_REGISTRY) {
            if (pageKeys.has(page.pageKey)) {
                conflicts.push(
                    this.registryConflict(
                        PagesBackfillConflictCode.INVALID_PAGE_KEY,
                        `Duplicate registry page key ${page.pageKey}`,
                        page.pageKey
                    )
                )
            }
            pageKeys.add(page.pageKey)
            for (const section of page.systemSections) {
                const owner = definitionKeys.get(section.key)
                if (owner !== undefined) {
                    conflicts.push(
                        this.registryConflict(
                            PagesBackfillConflictCode.SYSTEM_DEFINITION_MISMATCH,
                            `System definition key ${section.key} is duplicated by ${owner} and ${page.pageKey}`,
                            page.pageKey
                        )
                    )
                }
                definitionKeys.set(section.key, page.pageKey)
            }
        }
        if (definitionKeys.has(GLOBAL_CONTACTS_KEY)) {
            conflicts.push(
                this.registryConflict(
                    PagesBackfillConflictCode.SYSTEM_DEFINITION_MISMATCH,
                    `${GLOBAL_CONTACTS_KEY} must only be GLOBAL_SYSTEM`,
                    null
                )
            )
        }
    }

    private registryConflict(
        code: PagesBackfillConflictCode,
        message: string,
        pageKey: string | null
    ): PagesBackfillConflict {
        return { code, severity: 'BLOCKING', legacyTable: 'registry', legacyId: null, pageKey, message }
    }

    private definitionValues(
        values: Partial<PagesBackfillDefinitionValues> & Pick<PagesBackfillDefinitionValues, 'key' | 'type' | 'name'>
    ): PagesBackfillDefinitionValues {
        return {
            key: values.key,
            type: values.type,
            name: values.name,
            description: values.description ?? null,
            systemRendererKey: values.systemRendererKey ?? null,
            html: values.html ?? null,
            css: values.css ?? null,
            javascript: values.javascript ?? null,
            iframeHeight: values.iframeHeight ?? null,
            ownerPageKey: values.ownerPageKey ?? null,
        }
    }

    private definitionChanged(existing: SectionDefinition, values: PagesBackfillDefinitionValues) {
        return (
            existing.type !== values.type ||
            existing.name !== values.name ||
            existing.description !== values.description ||
            existing.system_renderer_key !== values.systemRendererKey ||
            existing.html !== values.html ||
            existing.css !== values.css ||
            existing.javascript !== values.javascript ||
            existing.iframe_height_px !== values.iframeHeight ||
            existing.owner_page_key !== values.ownerPageKey
        )
    }

    private definitionData(values: PagesBackfillDefinitionValues): Prisma.SectionDefinitionUncheckedCreateInput {
        return {
            key: values.key,
            type: values.type,
            name: values.name,
            description: values.description,
            system_renderer_key: values.systemRendererKey,
            html: values.html,
            css: values.css,
            javascript: values.javascript,
            iframe_height_px: values.iframeHeight,
            owner_page_key: values.ownerPageKey,
        }
    }

    private reportPageOrderCollisions(conflicts: PagesBackfillConflict[], pageKey: string, rows: PageSection[]) {
        const seen = new Map<number, number>()
        for (const row of rows) {
            const first = seen.get(row.sort_order)
            if (first !== undefined) {
                conflicts.push({
                    code: PagesBackfillConflictCode.ORDER_COLLISION,
                    severity: 'WARNING',
                    legacyTable: 'page_sections',
                    legacyId: row.id,
                    pageKey,
                    message: `Legacy page sections ${first} and ${row.id} share sort order ${row.sort_order}`,
                })
            } else seen.set(row.sort_order, row.id)
        }
    }

    private reportGlobalOrderCollisions(conflicts: PagesBackfillConflict[], rows: GlobalHtmlSection[]) {
        const seen = new Map<string, number>()
        for (const row of rows) {
            const key = String(row.sort_order)
            const first = seen.get(key)
            if (first !== undefined) {
                conflicts.push({
                    code: PagesBackfillConflictCode.ORDER_COLLISION,
                    severity: 'WARNING',
                    legacyTable: 'global_html_sections',
                    legacyId: row.id,
                    pageKey: null,
                    message: `Legacy global sections ${first} and ${row.id} share source sort order ${row.sort_order}`,
                })
            } else seen.set(key, row.id)
        }
    }

    private compareGlobals(left: GlobalHtmlSection, right: GlobalHtmlSection) {
        return (
            SLOT_ORDER[left.slot] - SLOT_ORDER[right.slot] || left.sort_order - right.sort_order || left.id - right.id
        )
    }
}
