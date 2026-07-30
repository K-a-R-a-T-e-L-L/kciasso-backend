import { ConflictException } from '@nestjs/common'
import { PrismaClient, SectionDefinitionType } from '@prisma/client'

import { closeE2eContext, createE2eContext } from './helpers/e2e-context'
import { PAGE_KEYS, getPageLayout, seedMaterializedPages } from './helpers/pages-fixtures'
import { PagesService } from '../src/system/pages/pages.service'

jest.setTimeout(120000)

describe('Pages concurrency and placement model (e2e)', () => {
    let context: Awaited<ReturnType<typeof createE2eContext>>
    let prisma: PrismaClient
    let service: PagesService

    beforeAll(async () => {
        context = await createE2eContext()
        prisma = context.prisma
        service = context.app.get(PagesService)
    })

    beforeEach(async () => {
        await prisma.pageSectionPlacement.deleteMany()
        await prisma.sectionDefinition.deleteMany()
        await prisma.pageLayout.deleteMany()
        await seedMaterializedPages(prisma)
    })

    afterAll(async () => closeE2eContext(context))

    const createGlobal = (name = 'Global') =>
        service.createGlobalCustom({ name, html: `<p>${name}</p>`, iframeHeight: 320 })

    it('materializes exactly 13 registry layouts', async () => {
        expect(await prisma.pageLayout.count({ where: { page_key: { in: PAGE_KEYS } } })).toBe(13)
    })

    it('materializes the exact home systems followed by contacts', async () => {
        const home = await getPageLayout(prisma, 'home')
        expect(home.placements.map(placement => placement.section_definition.key)).toEqual([
            'home.hero',
            'home.carousel',
            'home.main-sections',
            'home.important-resources',
            'home.gia',
            'home.official-resources',
            'global.contacts',
        ])
    })

    it('places contacts exactly once on every page', async () => {
        const contacts = await prisma.sectionDefinition.findUniqueOrThrow({ where: { key: 'global.contacts' } })
        expect(await prisma.pageSectionPlacement.count({ where: { section_definition_id: contacts.id } })).toBe(13)
        for (const pageKey of PAGE_KEYS) {
            expect(
                await prisma.pageSectionPlacement.count({
                    where: { page_key: pageKey, section_definition_id: contacts.id },
                })
            ).toBe(1)
        }
    })

    it('creates one global definition, 13 placements and 13 affected revisions', async () => {
        const result = await createGlobal()
        expect(result.affectedPages).toHaveLength(13)
        expect(
            await prisma.sectionDefinition.count({ where: { type: SectionDefinitionType.GLOBAL_CUSTOM_HTML } })
        ).toBe(1)
        expect(
            await prisma.pageSectionPlacement.count({
                where: { section_definition_id: result.globalDefinition.definitionId },
            })
        ).toBe(13)
    })

    it('calculates global append position independently for every page', async () => {
        const home = await prisma.pageLayout.findUniqueOrThrow({ where: { page_key: 'home' } })
        const news = await prisma.pageLayout.findUniqueOrThrow({ where: { page_key: 'news.archive' } })
        await prisma.pageSectionPlacement.updateMany({ where: { page_layout_id: home.id }, data: { sort_order: 50 } })
        await prisma.pageSectionPlacement.updateMany({ where: { page_layout_id: news.id }, data: { sort_order: 8 } })
        const created = await createGlobal()
        const placements = await prisma.pageSectionPlacement.findMany({
            where: { section_definition_id: created.globalDefinition.definitionId },
        })
        expect(placements.find(placement => placement.page_key === 'home')?.sort_order).toBe(51)
        expect(placements.find(placement => placement.page_key === 'news.archive')?.sort_order).toBe(9)
    })

    it('rolls back global create when one registry layout is missing', async () => {
        await prisma.pageLayout.delete({ where: { page_key: 'resources' } })
        const before = await prisma.sectionDefinition.count({
            where: { type: SectionDefinitionType.GLOBAL_CUSTOM_HTML },
        })
        await expect(createGlobal()).rejects.toMatchObject({
            response: { message: 'PAGE_LAYOUTS_NOT_MATERIALIZED', missingPageKeys: ['resources'] },
        })
        expect(
            await prisma.sectionDefinition.count({ where: { type: SectionDefinitionType.GLOBAL_CUSTOM_HTML } })
        ).toBe(before)
    })

    it('reorders a global placement on home without changing news.archive', async () => {
        await createGlobal()
        const home = await getPageLayout(prisma, 'home')
        const newsBefore = await getPageLayout(prisma, 'news.archive')
        await service.reorder('home', {
            sectionIds: [...home.placements.map(placement => placement.id)].reverse(),
            expectedRevision: home.revision,
        })
        const newsAfter = await getPageLayout(prisma, 'news.archive')
        expect(newsAfter.placements.map(placement => [placement.id, placement.sort_order])).toEqual(
            newsBefore.placements.map(placement => [placement.id, placement.sort_order])
        )
    })

    it('toggles a global placement on gia.9 independently', async () => {
        const created = await createGlobal()
        const gia = await getPageLayout(prisma, 'gia.9')
        const otherBefore = await getPageLayout(prisma, 'gia.11')
        const placement = gia.placements.find(
            row => row.section_definition_id === created.globalDefinition.definitionId
        )!
        await service.toggle('gia.9', placement.id, false, gia.revision)
        expect((await prisma.pageSectionPlacement.findUniqueOrThrow({ where: { id: placement.id } })).is_visible).toBe(
            false
        )
        expect((await getPageLayout(prisma, 'gia.11')).placements).toEqual(otherBefore.placements)
    })

    it('updates global content without changing placement order or visibility', async () => {
        const created = await createGlobal()
        const definitionId = created.globalDefinition.definitionId
        const home = await getPageLayout(prisma, 'home')
        const placement = home.placements.find(row => row.section_definition_id === definitionId)!
        await service.toggle('home', placement.id, false, home.revision)
        const before = await prisma.pageSectionPlacement.findMany({
            where: { section_definition_id: definitionId },
            orderBy: { page_key: 'asc' },
        })
        await service.updateGlobalCustom(definitionId, {
            expectedDefinitionRevision: created.globalDefinition.revision,
            html: '<p>updated</p>',
        })
        const after = await prisma.pageSectionPlacement.findMany({
            where: { section_definition_id: definitionId },
            orderBy: { page_key: 'asc' },
        })
        expect(after.map(row => [row.id, row.sort_order, row.is_visible])).toEqual(
            before.map(row => [row.id, row.sort_order, row.is_visible])
        )
    })

    it('allows exactly one concurrent global update for one revision', async () => {
        const created = await createGlobal()
        const calls = await Promise.allSettled([
            service.updateGlobalCustom(created.globalDefinition.definitionId, {
                expectedDefinitionRevision: created.globalDefinition.revision,
                name: 'First',
            }),
            service.updateGlobalCustom(created.globalDefinition.definitionId, {
                expectedDefinitionRevision: created.globalDefinition.revision,
                name: 'Second',
            }),
        ])
        expect(calls.filter(call => call.status === 'fulfilled')).toHaveLength(1)
        const failure = calls.find(call => call.status === 'rejected') as PromiseRejectedResult
        expect(failure.reason).toEqual(new ConflictException('STALE_SECTION_DEFINITION_REVISION'))
    })

    it('deletes a global definition and all 13 placements', async () => {
        const created = await createGlobal()
        const result = await service.deleteGlobalCustom(
            created.globalDefinition.definitionId,
            created.globalDefinition.revision
        )
        expect(result.affectedPages).toHaveLength(13)
        expect(await prisma.sectionDefinition.findUnique({ where: { id: result.definitionId } })).toBeNull()
        expect(await prisma.pageSectionPlacement.count({ where: { section_definition_id: result.definitionId } })).toBe(
            0
        )
    })

    it('preserves definition and remaining placements when one delete placement is missing', async () => {
        const created = await createGlobal()
        const definitionId = created.globalDefinition.definitionId
        const removed = await prisma.pageSectionPlacement.findFirstOrThrow({
            where: { section_definition_id: definitionId, page_key: 'resources' },
        })
        await prisma.pageSectionPlacement.delete({ where: { id: removed.id } })
        await expect(service.deleteGlobalCustom(definitionId, created.globalDefinition.revision)).rejects.toMatchObject(
            {
                response: { message: 'GLOBAL_SECTION_PLACEMENTS_INCOMPLETE', missingPageKeys: ['resources'] },
            }
        )
        expect(await prisma.sectionDefinition.findUnique({ where: { id: definitionId } })).not.toBeNull()
        expect(await prisma.pageSectionPlacement.count({ where: { section_definition_id: definitionId } })).toBe(12)
    })

    it('allows exactly one concurrent page toggle for one layout revision', async () => {
        const home = await getPageLayout(prisma, 'home')
        const placement = home.placements[0]
        const calls = await Promise.allSettled([
            service.toggle('home', placement.id, false, home.revision),
            service.toggle('home', placement.id, true, home.revision),
        ])
        expect(calls.filter(call => call.status === 'fulfilled')).toHaveLength(1)
        const failure = calls.find(call => call.status === 'rejected') as PromiseRejectedResult
        expect(failure.reason).toEqual(new ConflictException('STALE_PAGE_LAYOUT_REVISION'))
    })

    it('does not lose a page revision when global create races an old page toggle', async () => {
        const home = await getPageLayout(prisma, 'home')
        const createPromise = createGlobal('Race')
        await new Promise(resolve => setTimeout(resolve, 20))
        const calls = await Promise.allSettled([
            createPromise,
            service.toggle('home', home.placements[0].id, false, home.revision),
        ])
        expect(calls.filter(call => call.status === 'fulfilled')).toHaveLength(1)
        const failure = calls.find(call => call.status === 'rejected') as PromiseRejectedResult
        expect(failure.reason).toEqual(new ConflictException('STALE_PAGE_LAYOUT_REVISION'))
        expect((await prisma.pageLayout.findUniqueOrThrow({ where: { page_key: 'home' } })).revision).toBe(
            home.revision + 1
        )
    })

    it('rolls back definition, placements and revisions after injected global delete failure', async () => {
        const created = await createGlobal()
        const definitionId = created.globalDefinition.definitionId
        const revisionsBefore = await prisma.pageLayout.findMany({
            where: { page_key: { in: PAGE_KEYS } },
            select: { page_key: true, revision: true },
            orderBy: { page_key: 'asc' },
        })
        const realTransaction = prisma.$transaction.bind(prisma)
        const failingPrisma = {
            $transaction: async (callback: (tx: unknown) => unknown) =>
                realTransaction(async tx => {
                    const definitionDelegate = new Proxy(tx.sectionDefinition, {
                        get(target, property, receiver) {
                            if (property === 'delete')
                                return async () => Promise.reject(new Error('INJECTED_DELETE_FAILURE'))
                            return Reflect.get(target, property, receiver)
                        },
                    })
                    const failingTx = new Proxy(tx, {
                        get(target, property, receiver) {
                            if (property === 'sectionDefinition') return definitionDelegate
                            return Reflect.get(target, property, receiver)
                        },
                    })
                    return callback(failingTx)
                }),
        }
        const failingService = new PagesService(failingPrisma as never)

        await expect(
            failingService.deleteGlobalCustom(definitionId, created.globalDefinition.revision)
        ).rejects.toThrow('INJECTED_DELETE_FAILURE')
        expect(await prisma.sectionDefinition.findUnique({ where: { id: definitionId } })).not.toBeNull()
        expect(await prisma.pageSectionPlacement.count({ where: { section_definition_id: definitionId } })).toBe(13)
        expect(
            await prisma.pageLayout.findMany({
                where: { page_key: { in: PAGE_KEYS } },
                select: { page_key: true, revision: true },
                orderBy: { page_key: 'asc' },
            })
        ).toEqual(revisionsBefore)
    })
})
