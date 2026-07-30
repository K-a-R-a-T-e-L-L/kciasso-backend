import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, SectionDefinition, SectionDefinitionType } from '@prisma/client'

import { CreatePageSectionDto } from './dto/create-page-section.dto'
import { CreateGlobalHtmlSectionDto, UpdateGlobalHtmlSectionDto } from './dto/global-html-section.dto'
import { ReorderPageSectionsDto } from './dto/reorder-page-sections.dto'
import { UpdatePageSectionDto } from './dto/update-page-section.dto'
import { getPageRegistry, getPageRegistryEntry } from './pages.registry'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class PagesService {
    constructor(private readonly prisma: PrismaService) {}

    private async reservePageRevision(tx: Prisma.TransactionClient, pageKey: string, expectedRevision: number) {
        const reserved = await tx.pageLayout.updateMany({
            where: { page_key: pageKey, revision: expectedRevision },
            data: { revision: { increment: 1 } },
        })
        if (reserved.count === 1) return expectedRevision + 1
        if (!(await tx.pageLayout.findUnique({ where: { page_key: pageKey } })))
            throw new NotFoundException('Page layout is not materialized')
        throw new ConflictException('STALE_PAGE_LAYOUT_REVISION')
    }

    private async lockRegistryLayouts(tx: Prisma.TransactionClient) {
        const keys = getPageRegistry().map(page => page.pageKey)
        const rows = await tx.$queryRaw<Array<{ id: number; page_key: string; revision: number }>>(
            Prisma.sql`SELECT id, page_key, revision FROM page_layouts WHERE page_key IN (${Prisma.join(keys)}) ORDER BY page_key FOR UPDATE`
        )
        const found = new Set(rows.map(row => row.page_key))
        const missingPageKeys = keys.filter(key => !found.has(key))
        if (rows.length !== keys.length || missingPageKeys.length)
            throw new ConflictException({ message: 'PAGE_LAYOUTS_NOT_MATERIALIZED', missingPageKeys })
        return rows
    }

    private async lockGlobalDefinition(tx: Prisma.TransactionClient, definitionId: number): Promise<SectionDefinition> {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM section_definitions WHERE id = ${definitionId} FOR UPDATE`)
        const definition = await tx.sectionDefinition.findFirst({
            where: { id: definitionId, type: 'GLOBAL_CUSTOM_HTML' },
        })
        if (!definition) throw new NotFoundException('Global custom section not found')
        return definition
    }

    async listRegistry() {
        const registry = getPageRegistry()
        const layouts = await this.prisma.pageLayout.findMany({
            where: { page_key: { in: registry.map(x => x.pageKey) } },
            include: { placements: { include: { section_definition: true } } },
        })
        const byKey = new Map(layouts.map(x => [x.page_key, x]))
        return registry.map(page => {
            const layout = byKey.get(page.pageKey)
            const rows = layout?.placements ?? []
            return {
                pageKey: page.pageKey,
                title: page.title,
                routePattern: page.routePattern,
                revision: layout?.revision ?? 0,
                totalSections: rows.length,
                visibleSections: rows.filter(x => x.is_visible).length,
                hiddenSections: rows.filter(x => !x.is_visible).length,
                pageCustomHtmlSections: rows.filter(x => x.section_definition.type === 'PAGE_CUSTOM_HTML').length,
                globalCustomHtmlSections: rows.filter(x => x.section_definition.type === 'GLOBAL_CUSTOM_HTML').length,
                isMaterialized: Boolean(layout),
            }
        })
    }

    async getPublic(pageKey: string) {
        this.entry(pageKey)
        const layout = await this.prisma.pageLayout.findUnique({
            where: { page_key: pageKey },
            include: {
                placements: {
                    where: { is_visible: true },
                    orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
                    include: { section_definition: true },
                },
            },
        })
        return { pageKey, sections: (layout?.placements ?? []).map(x => this.publicDto(x)) }
    }

    async getAdmin(pageKey: string, raw = false) {
        const page = this.entry(pageKey)
        const layout = await this.prisma.pageLayout.findUnique({
            where: { page_key: pageKey },
            include: {
                placements: { orderBy: [{ sort_order: 'asc' }, { id: 'asc' }], include: { section_definition: true } },
            },
        })
        return {
            pageKey,
            title: page.title,
            routePattern: page.routePattern,
            revision: layout?.revision ?? 0,
            sections: (layout?.placements ?? []).map(x => this.adminDto(x, raw)),
        }
    }

    async createPageCustom(pageKey: string, dto: CreatePageSectionDto) {
        this.entry(pageKey)
        await this.prisma.$transaction(async tx => {
            const layout = await tx.pageLayout.findUnique({ where: { page_key: pageKey } })
            if (!layout) throw new NotFoundException('Page layout is not materialized')
            await this.reservePageRevision(tx, pageKey, dto.expectedRevision)
            const last = await tx.pageSectionPlacement.aggregate({
                where: { page_key: pageKey },
                _max: { sort_order: true },
            })
            const definition = await tx.sectionDefinition.create({
                data: {
                    type: SectionDefinitionType.PAGE_CUSTOM_HTML,
                    name: dto.name,
                    html: dto.html,
                    css: dto.css,
                    javascript: dto.javascript,
                    iframe_height_px: dto.iframeHeight ?? null,
                    owner_page_key: pageKey,
                },
            })
            const placement = await tx.pageSectionPlacement.create({
                data: {
                    page_layout_id: layout.id,
                    page_key: pageKey,
                    section_definition_id: definition.id,
                    sort_order: (last._max.sort_order ?? -1) + 1,
                },
                include: { section_definition: true },
            })
            return placement
        })
        return this.getAdmin(pageKey, true)
    }

    async updatePageCustom(pageKey: string, placementId: number, dto: UpdatePageSectionDto) {
        this.entry(pageKey)
        await this.prisma.$transaction(async tx => {
            const row = await tx.pageSectionPlacement.findFirst({
                where: { id: placementId, page_key: pageKey },
                include: { section_definition: true },
            })
            if (!row) throw new NotFoundException('Page placement not found')
            if (row.section_definition.type !== 'PAGE_CUSTOM_HTML')
                throw new BadRequestException('SYSTEM_SECTION_CONTENT_IMMUTABLE')
            await this.reservePageRevision(tx, pageKey, dto.expectedRevision)
            const definition = await tx.sectionDefinition.update({
                where: { id: row.section_definition_id },
                data: {
                    ...(dto.name !== undefined ? { name: dto.name } : {}),
                    ...(dto.html !== undefined ? { html: dto.html } : {}),
                    ...(dto.css !== undefined ? { css: dto.css } : {}),
                    ...(dto.javascript !== undefined ? { javascript: dto.javascript } : {}),
                    ...(dto.iframeHeight !== undefined ? { iframe_height_px: dto.iframeHeight } : {}),
                    revision: { increment: 1 },
                },
            })
            return definition
        })
        return this.getAdmin(pageKey, true)
    }

    async deletePageCustom(pageKey: string, placementId: number, revision: number) {
        this.entry(pageKey)
        await this.prisma.$transaction(async tx => {
            const row = await tx.pageSectionPlacement.findFirst({
                where: { id: placementId, page_key: pageKey },
                include: { section_definition: true },
            })
            if (!row) throw new NotFoundException('Page placement not found')
            if (row.section_definition.type === 'GLOBAL_CUSTOM_HTML')
                throw new BadRequestException('GLOBAL_PLACEMENT_DELETE_FORBIDDEN')
            if (row.section_definition.type !== 'PAGE_CUSTOM_HTML')
                throw new BadRequestException('SYSTEM_SECTION_DELETE_FORBIDDEN')
            await this.reservePageRevision(tx, pageKey, revision)
            await tx.pageSectionPlacement.delete({ where: { id: placementId } })
            await tx.sectionDefinition.delete({ where: { id: row.section_definition_id } })
        })
        return this.getAdmin(pageKey, true)
    }

    async toggle(pageKey: string, placementId: number, isVisible: boolean, revision: number) {
        this.entry(pageKey)
        await this.prisma.$transaction(async tx => {
            if (!(await tx.pageSectionPlacement.findFirst({ where: { id: placementId, page_key: pageKey } })))
                throw new NotFoundException('Page placement not found')
            await this.reservePageRevision(tx, pageKey, revision)
            await tx.pageSectionPlacement.update({ where: { id: placementId }, data: { is_visible: isVisible } })
        })
        return this.getAdmin(pageKey, true)
    }

    async reorder(pageKey: string, dto: ReorderPageSectionsDto) {
        this.entry(pageKey)
        await this.prisma.$transaction(async tx => {
            const rows = await tx.pageSectionPlacement.findMany({ where: { page_key: pageKey } })
            const ids = rows.map(x => x.id)
            if (
                ids.length !== dto.sectionIds.length ||
                new Set(dto.sectionIds).size !== ids.length ||
                dto.sectionIds.some(x => !ids.includes(x))
            )
                throw new BadRequestException('INVALID_PAGE_SECTION_ORDER')
            await this.reservePageRevision(tx, pageKey, dto.expectedRevision)
            await Promise.all(
                dto.sectionIds.map((id, sort_order) =>
                    tx.pageSectionPlacement.update({ where: { id }, data: { sort_order } })
                )
            )
        })
        return this.getAdmin(pageKey, true)
    }

    async listGlobalSections(raw: boolean) {
        const rows = await this.prisma.sectionDefinition.findMany({
            where: { type: 'GLOBAL_CUSTOM_HTML' },
            orderBy: { id: 'asc' },
            include: { placements: { select: { is_visible: true } } },
        })
        return rows.map(x => this.globalDto(x, raw))
    }
    async getGlobal(id: number, raw: boolean) {
        const row = await this.prisma.sectionDefinition.findFirst({
            where: { id, type: 'GLOBAL_CUSTOM_HTML' },
            include: { placements: { select: { is_visible: true } } },
        })
        if (!row) throw new NotFoundException('Global custom section not found')
        return this.globalDto(row, raw)
    }
    async createGlobalCustom(dto: CreateGlobalHtmlSectionDto) {
        return this.prisma.$transaction(async tx => {
            const locked = await this.lockRegistryLayouts(tx)
            const layouts = getPageRegistry().map(page => locked.find(layout => layout.page_key === page.pageKey)!)
            const definition = await tx.sectionDefinition.create({
                data: {
                    type: 'GLOBAL_CUSTOM_HTML',
                    name: dto.name,
                    html: dto.html,
                    css: dto.css,
                    javascript: dto.javascript,
                    iframe_height_px: dto.iframeHeight ?? null,
                },
            })
            const affectedPages: Array<{ pageKey: string; revision: number }> = []
            for (const layout of layouts) {
                const max = await tx.pageSectionPlacement.aggregate({
                    where: { page_layout_id: layout.id },
                    _max: { sort_order: true },
                })
                await tx.pageSectionPlacement.create({
                    data: {
                        page_layout_id: layout.id,
                        page_key: layout.page_key,
                        section_definition_id: definition.id,
                        sort_order: (max._max.sort_order ?? -1) + 1,
                    },
                })
                const updatedLayout = await tx.pageLayout.update({
                    where: { id: layout.id },
                    data: { revision: { increment: 1 } },
                })
                affectedPages.push({ pageKey: layout.page_key, revision: updatedLayout.revision })
            }
            return {
                globalDefinition: this.globalDto(definition, true, { total: layouts.length, visible: layouts.length }),
                affectedPages,
            }
        })
    }
    async updateGlobalCustom(id: number, dto: UpdateGlobalHtmlSectionDto) {
        return this.prisma.$transaction(async tx => {
            const current = await this.lockGlobalDefinition(tx, id)
            if (current.revision !== dto.expectedDefinitionRevision)
                throw new ConflictException('STALE_SECTION_DEFINITION_REVISION')
            const updated = await tx.sectionDefinition.update({
                where: { id },
                data: {
                    ...(dto.name !== undefined ? { name: dto.name } : {}),
                    ...(dto.html !== undefined ? { html: dto.html } : {}),
                    ...(dto.css !== undefined ? { css: dto.css } : {}),
                    ...(dto.javascript !== undefined ? { javascript: dto.javascript } : {}),
                    ...(dto.iframeHeight !== undefined ? { iframe_height_px: dto.iframeHeight } : {}),
                    revision: { increment: 1 },
                },
            })
            const placements = await tx.pageSectionPlacement.findMany({
                where: { section_definition_id: id },
                select: { is_visible: true },
            })
            return this.globalDto(updated, true, this.placementCounts(placements))
        })
    }
    async deleteGlobalCustom(id: number, expectedDefinitionRevision: number) {
        return this.prisma.$transaction(async tx => {
            const current = await this.lockGlobalDefinition(tx, id)
            if (current.revision !== expectedDefinitionRevision)
                throw new ConflictException('STALE_SECTION_DEFINITION_REVISION')
            const layouts = await this.lockRegistryLayouts(tx)
            const placements = await tx.pageSectionPlacement.findMany({
                where: { section_definition_id: id, page_key: { in: layouts.map(layout => layout.page_key) } },
                select: { page_layout_id: true, page_key: true },
                orderBy: { page_key: 'asc' },
            })
            const found = new Set(placements.map(placement => placement.page_key))
            const missingPageKeys = getPageRegistry()
                .map(page => page.pageKey)
                .filter(key => !found.has(key))
            if (placements.length !== layouts.length || missingPageKeys.length)
                throw new ConflictException({ message: 'GLOBAL_SECTION_PLACEMENTS_INCOMPLETE', missingPageKeys })
            await tx.pageSectionPlacement.deleteMany({ where: { section_definition_id: id } })
            await tx.sectionDefinition.delete({ where: { id } })
            const affectedPages: Array<{ pageKey: string; revision: number }> = []
            for (const layout of getPageRegistry().map(
                page => layouts.find(layout => layout.page_key === page.pageKey)!
            )) {
                const updatedLayout = await tx.pageLayout.update({
                    where: { id: layout.id },
                    data: { revision: { increment: 1 } },
                })
                affectedPages.push({ pageKey: updatedLayout.page_key, revision: updatedLayout.revision })
            }
            return { definitionId: id, affectedPages }
        })
    }

    private entry(key: string) {
        const e = getPageRegistryEntry(key)
        if (!e) throw new NotFoundException('Unknown page key')
        return e
    }
    private async layout(key: string) {
        this.entry(key)
        const l = await this.prisma.pageLayout.findUnique({ where: { page_key: key } })
        if (!l) throw new NotFoundException('Page layout is not materialized')
        return l
    }
    private async placement(key: string, id: number) {
        const p = await this.prisma.pageSectionPlacement.findFirst({
            where: { id, page_key: key },
            include: { section_definition: true },
        })
        if (!p) throw new NotFoundException('Page placement not found')
        return p
    }
    private assertRevision(layout: { revision: number }, expected: number) {
        if (layout.revision !== expected) throw new ConflictException('STALE_PAGE_LAYOUT_REVISION')
    }
    private publicDto(x: any) {
        const d = x.section_definition
        const custom = d.type.includes('CUSTOM_HTML')
        return {
            type: d.type,
            key: d.key,
            name: d.name,
            systemRendererKey: d.system_renderer_key,
            html: custom ? d.html : null,
            css: custom ? d.css : null,
            javascript: custom ? d.javascript : null,
            iframeHeight: custom ? d.iframe_height_px : null,
            isGlobal: d.type.startsWith('GLOBAL'),
            sortOrder: x.sort_order,
        }
    }
    private adminDto(x: any, raw: boolean) {
        const d = x.section_definition
        const custom = d.type.includes('CUSTOM_HTML')
        return {
            placementId: x.id,
            definitionId: d.id,
            type: d.type,
            key: d.key,
            name: d.name,
            description: d.description,
            systemRendererKey: d.system_renderer_key,
            sortOrder: x.sort_order,
            isVisible: x.is_visible,
            isGlobal: d.type.startsWith('GLOBAL'),
            ownerPageKey: d.owner_page_key,
            iframeHeight: d.iframe_height_px,
            canEditContent: raw && custom,
            canDelete: custom && d.type === 'PAGE_CUSTOM_HTML',
            canToggle: true,
            canReorder: true,
            editHref: custom ? `/admin/pages/${x.page_key}/sections/${x.id}` : null,
            definitionRevision: d.revision,
            ...(raw && custom ? { html: d.html, css: d.css, javascript: d.javascript } : {}),
        }
    }
    private placementCounts(placements: Array<{ is_visible: boolean }>) {
        const visible = placements.filter(placement => placement.is_visible).length
        return { total: placements.length, visible }
    }
    private globalDto(d: any, raw: boolean, counts = this.placementCounts(d.placements ?? [])) {
        return {
            definitionId: d.id,
            key: d.key,
            name: d.name,
            revision: d.revision,
            iframeHeight: d.iframe_height_px,
            visiblePlacements: counts.visible,
            hiddenPlacements: counts.total - counts.visible,
            totalPlacements: counts.total,
            ...(raw ? { html: d.html, css: d.css, javascript: d.javascript } : {}),
        }
    }
}
