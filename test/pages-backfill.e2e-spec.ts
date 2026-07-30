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
        expect(await prisma.pageSectionPlacement.count({ where: { section_definition_id: contacts.id } })).toBe(13)
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
})
