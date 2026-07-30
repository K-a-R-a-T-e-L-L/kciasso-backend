import { INestApplication } from '@nestjs/common'
import { PrismaClient, SectionDefinitionType } from '@prisma/client'
import * as request from 'supertest'

import { PAGE_REGISTRY } from '../../src/system/pages/pages.registry'

export const PAGE_KEYS = PAGE_REGISTRY.map(entry => entry.pageKey)

export async function seedMaterializedPages(prisma: PrismaClient): Promise<void> {
    for (const page of PAGE_REGISTRY) {
        const layout = await prisma.pageLayout.upsert({
            where: { page_key: page.pageKey },
            create: { page_key: page.pageKey },
            update: {},
        })
        let nextOrder =
            (
                await prisma.pageSectionPlacement.aggregate({
                    where: { page_layout_id: layout.id },
                    _max: { sort_order: true },
                })
            )._max.sort_order ?? -1
        for (const system of page.systemSections) {
            const definition = await prisma.sectionDefinition.upsert({
                where: { key: system.key },
                create: {
                    key: system.key,
                    type: SectionDefinitionType.PAGE_SYSTEM,
                    name: system.name,
                    system_renderer_key: system.systemRendererKey,
                    owner_page_key: page.pageKey,
                },
                update: {
                    type: SectionDefinitionType.PAGE_SYSTEM,
                    name: system.name,
                    system_renderer_key: system.systemRendererKey,
                    owner_page_key: page.pageKey,
                },
            })
            await prisma.pageSectionPlacement.upsert({
                where: {
                    page_key_section_definition_id: {
                        page_key: page.pageKey,
                        section_definition_id: definition.id,
                    },
                },
                create: {
                    page_layout_id: layout.id,
                    page_key: page.pageKey,
                    section_definition_id: definition.id,
                    sort_order: ++nextOrder,
                },
                update: {},
            })
        }
    }

    const contacts = await prisma.sectionDefinition.upsert({
        where: { key: 'global.contacts' },
        create: {
            key: 'global.contacts',
            type: SectionDefinitionType.GLOBAL_SYSTEM,
            name: 'Контакты',
            system_renderer_key: 'global.contacts',
        },
        update: {
            type: SectionDefinitionType.GLOBAL_SYSTEM,
            name: 'Контакты',
            system_renderer_key: 'global.contacts',
            owner_page_key: null,
        },
    })
    for (const pageKey of PAGE_KEYS) {
        const layout = await prisma.pageLayout.findUniqueOrThrow({ where: { page_key: pageKey } })
        const max = await prisma.pageSectionPlacement.aggregate({
            where: { page_layout_id: layout.id },
            _max: { sort_order: true },
        })
        await prisma.pageSectionPlacement.upsert({
            where: {
                page_key_section_definition_id: { page_key: pageKey, section_definition_id: contacts.id },
            },
            create: {
                page_layout_id: layout.id,
                page_key: pageKey,
                section_definition_id: contacts.id,
                sort_order: (max._max.sort_order ?? -1) + 1,
            },
            update: {},
        })
    }
}

export async function authenticateSuperAdmin(app: INestApplication): Promise<string> {
    const response = await request(app.getHttpServer())
        .post('/api/user/authenticate')
        .send({
            email: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
            password: process.env.SUPER_ADMIN_PASSWORD || 'change_me_12345',
        })
    if (response.status !== 201 || !response.body.token) throw new Error('SUPER_ADMIN_AUTHENTICATION_FAILED')
    return response.body.token
}

export async function getPageLayout(prisma: PrismaClient, pageKey: string) {
    return prisma.pageLayout.findUniqueOrThrow({
        where: { page_key: pageKey },
        include: {
            placements: {
                orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
                include: { section_definition: true },
            },
        },
    })
}
