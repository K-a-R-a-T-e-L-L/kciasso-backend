import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { SectionDefinitionType } from '@prisma/client'

import { PAGE_REGISTRY } from './pages.registry'
import { PagesService } from './pages.service'

const pageDefinition = (type: SectionDefinitionType) => ({
    id: 10,
    key: type === SectionDefinitionType.PAGE_SYSTEM ? 'home.hero' : null,
    type,
    name: 'Section',
    description: null,
    system_renderer_key: type.includes('SYSTEM') ? 'home.hero' : null,
    html: '<p>x</p>',
    css: null,
    javascript: null,
    iframe_height_px: null,
    owner_page_key: type.startsWith('PAGE') ? 'home' : null,
    revision: 1,
})

function createService(tx: any = {}, root: any = {}) {
    const prisma = {
        $transaction: jest.fn(async (callback: (client: any) => unknown) => callback(tx)),
        pageLayout: { findUnique: jest.fn(), findMany: jest.fn(), ...root.pageLayout },
        sectionDefinition: { findMany: jest.fn(), findFirst: jest.fn(), ...root.sectionDefinition },
        ...root,
    }
    return { service: new PagesService(prisma as never), prisma }
}

describe('PagesService', () => {
    it('reserves a page revision conditionally', async () => {
        const tx = { pageLayout: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn() } }
        const { service } = createService()
        await expect((service as any).reservePageRevision(tx, 'home', 4)).resolves.toBe(5)
        expect(tx.pageLayout.updateMany).toHaveBeenCalledWith({
            where: { page_key: 'home', revision: 4 },
            data: { revision: { increment: 1 } },
        })
    })

    it('returns stale conflict for an existing layout', async () => {
        const tx = {
            pageLayout: {
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
                findUnique: jest.fn().mockResolvedValue({ id: 1 }),
            },
        }
        const { service } = createService()
        await expect((service as any).reservePageRevision(tx, 'home', 4)).rejects.toEqual(
            new ConflictException('STALE_PAGE_LAYOUT_REVISION')
        )
    })

    it('returns not found when the layout is missing', async () => {
        const tx = {
            pageLayout: {
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
                findUnique: jest.fn().mockResolvedValue(null),
            },
        }
        const { service } = createService()
        await expect((service as any).reservePageRevision(tx, 'home', 0)).rejects.toEqual(
            new NotFoundException('Page layout is not materialized')
        )
    })

    it('creates page custom content after reserving revision in the transaction', async () => {
        const tx = {
            pageLayout: {
                findUnique: jest.fn().mockResolvedValue({ id: 1 }),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            pageSectionPlacement: {
                aggregate: jest.fn().mockResolvedValue({ _max: { sort_order: 2 } }),
                create: jest.fn().mockResolvedValue({}),
            },
            sectionDefinition: { create: jest.fn().mockResolvedValue({ id: 20 }) },
        }
        const { service, prisma } = createService(tx, {
            pageLayout: { findUnique: jest.fn().mockResolvedValue({ revision: 2, placements: [] }) },
        })
        await service.createPageCustom('home', { name: 'Custom', html: '<p>x</p>', expectedRevision: 1 })
        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
        expect(tx.pageLayout.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
            tx.sectionDefinition.create.mock.invocationCallOrder[0]
        )
    })

    it('rejects PAGE_SYSTEM content updates', async () => {
        const tx = {
            pageSectionPlacement: {
                findFirst: jest
                    .fn()
                    .mockResolvedValue({ section_definition: pageDefinition(SectionDefinitionType.PAGE_SYSTEM) }),
            },
        }
        const { service } = createService(tx)
        await expect(service.updatePageCustom('home', 1, { expectedRevision: 0 })).rejects.toEqual(
            new BadRequestException('SYSTEM_SECTION_CONTENT_IMMUTABLE')
        )
    })

    it.each([SectionDefinitionType.PAGE_SYSTEM, SectionDefinitionType.GLOBAL_SYSTEM])(
        'rejects deletion of %s',
        async type => {
            const tx = {
                pageSectionPlacement: {
                    findFirst: jest.fn().mockResolvedValue({ section_definition: pageDefinition(type) }),
                },
            }
            const { service } = createService(tx)
            await expect(service.deletePageCustom('home', 1, 0)).rejects.toEqual(
                new BadRequestException('SYSTEM_SECTION_DELETE_FORBIDDEN')
            )
        }
    )

    it('rejects deletion of a GLOBAL_CUSTOM_HTML placement from a page', async () => {
        const tx = {
            pageSectionPlacement: {
                findFirst: jest.fn().mockResolvedValue({
                    section_definition: pageDefinition(SectionDefinitionType.GLOBAL_CUSTOM_HTML),
                }),
            },
        }
        const { service } = createService(tx)
        await expect(service.deletePageCustom('home', 1, 0)).rejects.toEqual(
            new BadRequestException('GLOBAL_PLACEMENT_DELETE_FORBIDDEN')
        )
    })

    it('returns a full layout after toggle', async () => {
        const tx = {
            pageLayout: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
            pageSectionPlacement: {
                findFirst: jest.fn().mockResolvedValue({ id: 1 }),
                update: jest.fn().mockResolvedValue({}),
            },
        }
        const { service } = createService(tx, {
            pageLayout: { findUnique: jest.fn().mockResolvedValue({ revision: 2, placements: [] }) },
        })
        await expect(service.toggle('home', 1, false, 1)).resolves.toMatchObject({
            pageKey: 'home',
            revision: 2,
            sections: [],
        })
    })

    it.each([
        ['duplicate', [1, 1]],
        ['incomplete', [1]],
        ['foreign', [1, 3]],
    ])('rejects %s reorder IDs', async (_case, sectionIds) => {
        const tx = { pageSectionPlacement: { findMany: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]) } }
        const { service } = createService(tx)
        await expect(service.reorder('home', { sectionIds, expectedRevision: 0 })).rejects.toEqual(
            new BadRequestException('INVALID_PAGE_SECTION_ORDER')
        )
    })

    it('requires all 13 registry layouts while locking', async () => {
        const tx = {
            $queryRaw: jest.fn().mockResolvedValue(
                PAGE_REGISTRY.slice(0, 12).map((page, index) => ({
                    id: index + 1,
                    page_key: page.pageKey,
                    revision: 0,
                }))
            ),
        }
        const { service } = createService()
        await expect((service as any).lockRegistryLayouts(tx)).rejects.toMatchObject({
            response: { message: 'PAGE_LAYOUTS_NOT_MATERIALIZED', missingPageKeys: ['resources'] },
        })
    })

    it('rejects a stale global update while the definition is locked', async () => {
        const tx = {
            $queryRaw: jest.fn().mockResolvedValue([]),
            sectionDefinition: {
                findFirst: jest.fn().mockResolvedValue(pageDefinition(SectionDefinitionType.GLOBAL_CUSTOM_HTML)),
            },
        }
        const { service } = createService(tx)
        await expect(service.updateGlobalCustom(10, { expectedDefinitionRevision: 0 })).rejects.toEqual(
            new ConflictException('STALE_SECTION_DEFINITION_REVISION')
        )
    })

    it('rejects global delete when one placement is missing', async () => {
        const layouts = PAGE_REGISTRY.map((page, index) => ({ id: index + 1, page_key: page.pageKey, revision: 0 }))
        const tx = {
            $queryRaw: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(layouts),
            sectionDefinition: {
                findFirst: jest.fn().mockResolvedValue(pageDefinition(SectionDefinitionType.GLOBAL_CUSTOM_HTML)),
            },
            pageSectionPlacement: {
                findMany: jest
                    .fn()
                    .mockResolvedValue(
                        layouts.slice(0, 12).map(layout => ({ page_layout_id: layout.id, page_key: layout.page_key }))
                    ),
            },
        }
        const { service } = createService(tx)
        await expect(service.deleteGlobalCustom(10, 1)).rejects.toMatchObject({
            response: { message: 'GLOBAL_SECTION_PLACEMENTS_INCOMPLETE', missingPageKeys: ['resources'] },
        })
    })

    it('queries public sections with hidden filtering and deterministic ordering', async () => {
        const definition = pageDefinition(SectionDefinitionType.PAGE_SYSTEM)
        const findUnique = jest.fn().mockResolvedValue({
            placements: [{ id: 2, sort_order: 0, section_definition: definition }],
        })
        const { service } = createService({}, { pageLayout: { findUnique } })
        const result = await service.getPublic('home')
        expect(findUnique).toHaveBeenCalledWith({
            where: { page_key: 'home' },
            include: {
                placements: {
                    where: { is_visible: true },
                    orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
                    include: { section_definition: true },
                },
            },
        })
        expect(result.sections).toHaveLength(1)
    })
})
