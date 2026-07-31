import { GlobalHtmlSlot, PageSectionType, PrismaClient, SectionDefinitionType } from '@prisma/client'

import { assertSafeE2eDatabase, closeE2eContext, createE2eContext } from './helpers/e2e-context'
import { PagesBackfillService } from '../src/system/pages/pages-backfill.service'
import { PagesBackfillConflictCode } from '../src/system/pages/pages-backfill.types'
import { PAGE_REGISTRY } from '../src/system/pages/pages.registry'

jest.setTimeout(120000)

describe('Pages definition/placement backfill (e2e)', () => {
    let context: Awaited<ReturnType<typeof createE2eContext>>
    let prisma: PrismaClient

    beforeAll(async () => {
        context = await createE2eContext()
        prisma = context.prisma
    })

    beforeEach(async () => {
        await prisma.pageSectionPlacement.deleteMany()
        await prisma.sectionDefinition.deleteMany()
        await prisma.pageSection.deleteMany()
        await prisma.globalHtmlSection.deleteMany()
        await prisma.pageLayout.deleteMany()
    })

    afterAll(async () => closeE2eContext(context))

    async function seedLegacyFixture() {
        const layouts = new Map<string, number>()
        for (const page of PAGE_REGISTRY) {
            const layout = await prisma.pageLayout.create({ data: { page_key: page.pageKey } })
            layouts.set(page.pageKey, layout.id)
        }
        const homeId = layouts.get('home')!
        await prisma.pageSection.createMany({
            data: [
                {
                    page_layout_id: homeId,
                    type: PageSectionType.SYSTEM,
                    system_key: 'home.hero',
                    internal_name: 'Hero',
                    sort_order: 0,
                },
                {
                    page_layout_id: homeId,
                    type: PageSectionType.SYSTEM,
                    system_key: 'home.carousel',
                    internal_name: 'Carousel',
                    sort_order: 0,
                },
            ],
        })
        const enabled = await prisma.pageSection.create({
            data: {
                page_layout_id: homeId,
                type: PageSectionType.CUSTOM_HTML,
                internal_name: 'Enabled custom',
                raw_html: '<section>enabled</section>',
                iframe_height_px: 444,
                sort_order: 2,
                is_enabled: true,
            },
        })
        const disabled = await prisma.pageSection.create({
            data: {
                page_layout_id: homeId,
                type: PageSectionType.CUSTOM_HTML,
                internal_name: 'Disabled custom',
                raw_html: '<section>disabled</section>',
                iframe_height_px: 555,
                sort_order: 3,
                is_enabled: false,
            },
        })
        const duplicateOne = await prisma.pageSection.create({
            data: {
                page_layout_id: homeId,
                type: PageSectionType.CUSTOM_HTML,
                internal_name: 'Duplicate',
                raw_html: '<p>same</p>',
                sort_order: 4,
            },
        })
        const duplicateTwo = await prisma.pageSection.create({
            data: {
                page_layout_id: homeId,
                type: PageSectionType.CUSTOM_HTML,
                internal_name: 'Duplicate',
                raw_html: '<p>same</p>',
                sort_order: 5,
            },
        })
        const nullHtml = await prisma.pageSection.create({
            data: {
                page_layout_id: homeId,
                type: PageSectionType.CUSTOM_HTML,
                internal_name: 'Null HTML',
                raw_html: null,
                sort_order: 6,
            },
        })
        const globalOne = await prisma.globalHtmlSection.create({
            data: {
                key: 'legacy-global-one',
                name: 'Legacy global one',
                html: '<aside>global</aside>',
                css: '.global { color: red; }',
                javascript: 'window.legacy = true;',
                iframe_height_px: 666,
                slot: GlobalHtmlSlot.BEFORE_CONTENT,
                sort_order: 5,
                is_enabled: true,
            },
        })
        const globalTwo = await prisma.globalHtmlSection.create({
            data: {
                key: 'legacy-global-two',
                name: 'Legacy global two',
                html: '<aside>second</aside>',
                slot: GlobalHtmlSlot.AFTER_CONTENT,
                sort_order: 5,
                is_enabled: false,
            },
        })
        return { enabled, disabled, duplicateOne, duplicateTwo, nullHtml, globalOne, globalTwo }
    }

    it('rejects unsafe E2E database targets before destructive work', () => {
        expect(() => assertSafeE2eDatabase('postgresql://user:pass@remote.example.com/db_e2e')).toThrow(
            'UNSAFE_E2E_DATABASE_TARGET'
        )
        expect(() => assertSafeE2eDatabase('postgresql://user:pass@localhost/kciasso_backend_dev')).toThrow(
            'UNSAFE_E2E_DATABASE_TARGET'
        )
        expect(() => assertSafeE2eDatabase('postgresql://user:pass@127.0.0.1/safe_e2e')).not.toThrow()
    })

    it('preserves legacy data, deterministic order and true repeated-apply idempotence', async () => {
        const fixture = await seedLegacyFixture()
        const service = new PagesBackfillService(prisma)
        const countsBeforeDryRun = {
            definitions: await prisma.sectionDefinition.count(),
            placements: await prisma.pageSectionPlacement.count(),
        }
        const dryRun = await service.run('dry-run')
        expect(dryRun.applied).toBe(false)
        expect(await prisma.sectionDefinition.count()).toBe(countsBeforeDryRun.definitions)
        expect(await prisma.pageSectionPlacement.count()).toBe(countsBeforeDryRun.placements)
        expect(dryRun.conflicts).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: PagesBackfillConflictCode.ORDER_COLLISION, severity: 'WARNING' }),
                expect.objectContaining({
                    code: PagesBackfillConflictCode.MISSING_LEGACY_HTML,
                    severity: 'WARNING',
                    legacyId: fixture.nullHtml.id,
                }),
            ])
        )

        const first = await service.run('apply')
        expect(first.applied).toBe(true)
        expect(first.definitionsCreated).toBeGreaterThan(0)
        expect(first.placementsCreated).toBeGreaterThan(0)
        const enabledDefinition = await prisma.sectionDefinition.findUniqueOrThrow({
            where: { key: `legacy.page-section.${fixture.enabled.id}` },
        })
        expect(enabledDefinition.html).toBe('<section>enabled</section>')
        expect(enabledDefinition.iframe_height_px).toBe(444)
        const disabledDefinition = await prisma.sectionDefinition.findUniqueOrThrow({
            where: { key: `legacy.page-section.${fixture.disabled.id}` },
        })
        const disabledPlacement = await prisma.pageSectionPlacement.findUniqueOrThrow({
            where: {
                page_key_section_definition_id: {
                    page_key: 'home',
                    section_definition_id: disabledDefinition.id,
                },
            },
        })
        expect(disabledPlacement.is_visible).toBe(false)
        const duplicateDefinitions = await prisma.sectionDefinition.findMany({
            where: {
                key: {
                    in: [
                        `legacy.page-section.${fixture.duplicateOne.id}`,
                        `legacy.page-section.${fixture.duplicateTwo.id}`,
                    ],
                },
            },
        })
        expect(duplicateDefinitions).toHaveLength(2)
        expect(new Set(duplicateDefinitions.map(definition => definition.id)).size).toBe(2)
        expect(
            await prisma.sectionDefinition.findUniqueOrThrow({
                where: { key: `legacy.page-section.${fixture.nullHtml.id}` },
            })
        ).toMatchObject({ html: '' })

        const globalDefinition = await prisma.sectionDefinition.findUniqueOrThrow({
            where: { key: `legacy.global-html.${fixture.globalOne.id}` },
        })
        expect(globalDefinition).toMatchObject({
            html: '<aside>global</aside>',
            css: '.global { color: red; }',
            javascript: 'window.legacy = true;',
            iframe_height_px: 666,
        })
        expect(await prisma.pageSectionPlacement.count({ where: { section_definition_id: globalDefinition.id } })).toBe(
            13
        )
        const contacts = await prisma.sectionDefinition.findUniqueOrThrow({ where: { key: 'global.contacts' } })
        expect(await prisma.pageSectionPlacement.count({ where: { section_definition_id: contacts.id } })).toBe(12)
        expect(
            await prisma.pageSectionPlacement.count({
                where: { page_key: 'about.contacts', section_definition_id: contacts.id },
            })
        ).toBe(0)
        const homePlacements = await prisma.pageSectionPlacement.findMany({
            where: { page_key: 'home' },
            orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
            include: { section_definition: true },
        })
        expect(homePlacements.map(placement => placement.sort_order)).toEqual(homePlacements.map((_, index) => index))
        const contactsIndex = homePlacements.findIndex(
            placement => placement.section_definition.key === 'global.contacts'
        )
        const firstGlobalIndex = homePlacements.findIndex(
            placement => placement.section_definition.key === `legacy.global-html.${fixture.globalOne.id}`
        )
        const secondGlobalIndex = homePlacements.findIndex(
            placement => placement.section_definition.key === `legacy.global-html.${fixture.globalTwo.id}`
        )
        expect(contactsIndex).toBeLessThan(firstGlobalIndex)
        expect(firstGlobalIndex).toBeLessThan(secondGlobalIndex)

        const revisionsBeforeSecond = await prisma.pageLayout.findMany({
            select: { page_key: true, revision: true },
            orderBy: { page_key: 'asc' },
        })
        const second = await service.run('apply')
        expect(second).toMatchObject({
            applied: true,
            definitionsCreated: 0,
            definitionsUpdated: 0,
            placementsCreated: 0,
            placementsUpdated: 0,
            layoutsCreated: 0,
            layoutsRevisionIncremented: 0,
        })
        expect(
            await prisma.pageLayout.findMany({
                select: { page_key: true, revision: true },
                orderBy: { page_key: 'asc' },
            })
        ).toEqual(revisionsBeforeSecond)
    })

    it('reports invalid legacy page key as blocking and applies zero writes', async () => {
        await seedLegacyFixture()
        await prisma.pageLayout.create({ data: { page_key: 'unknown.legacy' } })
        const service = new PagesBackfillService(prisma)
        const before = {
            definitions: await prisma.sectionDefinition.count(),
            placements: await prisma.pageSectionPlacement.count(),
            revisions: await prisma.pageLayout.findMany({
                select: { id: true, revision: true },
                orderBy: { id: 'asc' },
            }),
        }
        const result = await service.run('apply')
        expect(result.applied).toBe(false)
        expect(result.conflicts).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    code: PagesBackfillConflictCode.INVALID_PAGE_KEY,
                    severity: 'BLOCKING',
                    pageKey: 'unknown.legacy',
                }),
            ])
        )
        expect(result).toMatchObject({
            definitionsCreated: 0,
            placementsCreated: 0,
            layoutsRevisionIncremented: 0,
        })
        expect(await prisma.sectionDefinition.count()).toBe(before.definitions)
        expect(await prisma.pageSectionPlacement.count()).toBe(before.placements)
        expect(
            await prisma.pageLayout.findMany({ select: { id: true, revision: true }, orderBy: { id: 'asc' } })
        ).toEqual(before.revisions)
    })

    it('reports stable legacy key collision as blocking and applies zero writes', async () => {
        const fixture = await seedLegacyFixture()
        await prisma.sectionDefinition.create({
            data: {
                key: `legacy.page-section.${fixture.enabled.id}`,
                type: SectionDefinitionType.GLOBAL_CUSTOM_HTML,
                name: 'Collision',
                html: '<p>collision</p>',
            },
        })
        const service = new PagesBackfillService(prisma)
        const before = {
            definitions: await prisma.sectionDefinition.count(),
            placements: await prisma.pageSectionPlacement.count(),
        }
        const result = await service.run('apply')
        expect(result.applied).toBe(false)
        expect(result.conflicts).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    code: PagesBackfillConflictCode.LEGACY_DEFINITION_KEY_COLLISION,
                    severity: 'BLOCKING',
                    legacyId: fixture.enabled.id,
                }),
            ])
        )
        expect(result).toMatchObject({ definitionsCreated: 0, placementsCreated: 0, layoutsRevisionIncremented: 0 })
        expect(await prisma.sectionDefinition.count()).toBe(before.definitions)
        expect(await prisma.pageSectionPlacement.count()).toBe(before.placements)
    })

    it('repairs managed GIA-11 sections and about contacts without touching custom rows', async () => {
        await seedLegacyFixture()
        const service = new PagesBackfillService(prisma)
        await service.run('apply')
        const giaLayout = await prisma.pageLayout.findUniqueOrThrow({ where: { page_key: 'gia.11' } })
        const aboutContactsLayout = await prisma.pageLayout.findUniqueOrThrow({
            where: { page_key: 'about.contacts' },
        })
        const contacts = await prisma.sectionDefinition.findUniqueOrThrow({ where: { key: 'global.contacts' } })
        await prisma.pageSectionPlacement.create({
            data: {
                page_layout_id: aboutContactsLayout.id,
                page_key: 'about.contacts',
                section_definition_id: contacts.id,
                sort_order: 1_000_000,
            },
        })
        const replacementDefinitions = await prisma.sectionDefinition.findMany({
            where: { key: { in: ['gia-11.essay', 'gia-11.analytics'] } },
        })
        await prisma.pageSectionPlacement.deleteMany({
            where: { section_definition_id: { in: replacementDefinitions.map(definition => definition.id) } },
        })
        await prisma.sectionDefinition.deleteMany({
            where: { id: { in: replacementDefinitions.map(definition => definition.id) } },
        })
        const additional = await prisma.sectionDefinition.create({
            data: {
                key: 'gia-11.additional',
                type: SectionDefinitionType.PAGE_SYSTEM,
                name: 'Additional',
                system_renderer_key: 'gia-11.additional',
                owner_page_key: 'gia.11',
            },
        })
        await prisma.pageSectionPlacement.create({
            data: {
                page_layout_id: giaLayout.id,
                page_key: 'gia.11',
                section_definition_id: additional.id,
                sort_order: 6,
            },
        })
        const customDefinitionsBefore = await prisma.sectionDefinition.findMany({
            where: { type: { in: ['PAGE_CUSTOM_HTML', 'GLOBAL_CUSTOM_HTML'] } },
            orderBy: { id: 'asc' },
        })
        const customPlacementsBefore = await prisma.pageSectionPlacement.findMany({
            where: { section_definition: { type: { in: ['PAGE_CUSTOM_HTML', 'GLOBAL_CUSTOM_HTML'] } } },
            orderBy: { id: 'asc' },
        })
        const revisionsBefore = new Map(
            (
                await prisma.pageLayout.findMany({
                    where: { page_key: { in: ['gia.11', 'about.contacts'] } },
                    select: { page_key: true, revision: true },
                })
            ).map(layout => [layout.page_key, layout.revision])
        )

        const result = await service.run('apply')

        expect(result).toMatchObject({
            placementsCreated: 2,
            placementsDeleted: 2,
            definitionsDeleted: 1,
            customRowsChanged: 0,
        })
        expect(
            await prisma.pageSectionPlacement.findMany({
                where: {
                    page_key: 'gia.11',
                    section_definition: { key: { in: ['gia-11.essay', 'gia-11.analytics'] } },
                },
                orderBy: { sort_order: 'asc' },
                include: { section_definition: true },
            })
        ).toMatchObject([
            { sort_order: 6, section_definition: { key: 'gia-11.essay' } },
            { sort_order: 7, section_definition: { key: 'gia-11.analytics' } },
        ])
        expect(await prisma.sectionDefinition.findUnique({ where: { key: 'gia-11.additional' } })).toBeNull()
        for (const pageKey of ['gia.11', 'about.contacts']) {
            expect((await prisma.pageLayout.findUniqueOrThrow({ where: { page_key: pageKey } })).revision).toBe(
                revisionsBefore.get(pageKey)! + 1
            )
        }
        expect(
            await prisma.pageSectionPlacement.count({
                where: { page_key: 'about.contacts', section_definition_id: contacts.id },
            })
        ).toBe(0)
        expect(
            await prisma.pageSectionPlacement.count({
                where: { section_definition_id: contacts.id, page_key: { not: 'about.contacts' } },
            })
        ).toBe(12)
        expect(
            await prisma.sectionDefinition.findMany({
                where: { type: { in: ['PAGE_CUSTOM_HTML', 'GLOBAL_CUSTOM_HTML'] } },
                orderBy: { id: 'asc' },
            })
        ).toEqual(customDefinitionsBefore)
        expect(
            await prisma.pageSectionPlacement.findMany({
                where: { section_definition: { type: { in: ['PAGE_CUSTOM_HTML', 'GLOBAL_CUSTOM_HTML'] } } },
                orderBy: { id: 'asc' },
            })
        ).toEqual(customPlacementsBefore)
        expect(await service.run('apply')).toMatchObject({
            definitionsCreated: 0,
            placementsCreated: 0,
            placementsDeleted: 0,
            definitionsDeleted: 0,
            layoutsRevisionIncremented: 0,
            customRowsChanged: 0,
        })
    })

    it('rolls back every write when an apply plan fails inside the transaction', async () => {
        await seedLegacyFixture()
        const service = new PagesBackfillService(prisma)
        const plan = await service.analyze()
        plan.placementsToCreate.push({
            pageKey: 'home',
            definitionKey: 'missing.definition.for.rollback',
            sortOrder: 999,
            isVisible: true,
        })
        const before = {
            definitions: await prisma.sectionDefinition.count(),
            placements: await prisma.pageSectionPlacement.count(),
            layouts: await prisma.pageLayout.findMany({
                select: { page_key: true, revision: true },
                orderBy: { page_key: 'asc' },
            }),
        }

        await expect(service.apply(plan)).rejects.toThrow(
            'BACKFILL_PLAN_REFERENCE_MISSING:home:missing.definition.for.rollback'
        )
        expect(await prisma.sectionDefinition.count()).toBe(before.definitions)
        expect(await prisma.pageSectionPlacement.count()).toBe(before.placements)
        expect(
            await prisma.pageLayout.findMany({
                select: { page_key: true, revision: true },
                orderBy: { page_key: 'asc' },
            })
        ).toEqual(before.layouts)
    })

    it('keeps concurrent invocations safe after the canonical state converges', async () => {
        await seedLegacyFixture()
        const firstService = new PagesBackfillService(prisma)
        await firstService.run('apply')

        const [left, right] = await Promise.all([
            new PagesBackfillService(prisma).run('apply'),
            new PagesBackfillService(prisma).run('apply'),
        ])

        for (const result of [left, right]) {
            expect(result).toMatchObject({
                applied: true,
                definitionsCreated: 0,
                definitionsUpdated: 0,
                placementsCreated: 0,
                placementsDeleted: 0,
                definitionsDeleted: 0,
                layoutsRevisionIncremented: 0,
                customRowsChanged: 0,
            })
        }
    })
})
