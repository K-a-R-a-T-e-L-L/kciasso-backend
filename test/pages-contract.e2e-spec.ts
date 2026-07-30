import { INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import * as bcryptjs from 'bcryptjs'
import * as request from 'supertest'

import { closeE2eContext, createE2eContext } from './helpers/e2e-context'
import { authenticateSuperAdmin, seedMaterializedPages } from './helpers/pages-fixtures'

jest.setTimeout(120000)

describe('Pages HTTP and OpenAPI contract (e2e)', () => {
    let context: Awaited<ReturnType<typeof createE2eContext>>
    let app: INestApplication
    let prisma: PrismaClient
    let superToken: string
    let adminToken: string

    const auth = (token = superToken) => ({ Authorization: `Bearer ${token}` })
    const getLayout = (pageKey = 'home', token = superToken) =>
        request(app.getHttpServer()).get(`/api/admin/pages/${pageKey}/layout`).set(auth(token))
    const createPageCustom = (expectedRevision: number, token = superToken) =>
        request(app.getHttpServer())
            .post('/api/admin/pages/home/sections')
            .set(auth(token))
            .send({ name: 'Custom', html: '<p>custom</p>', expectedRevision })
    const createGlobal = (token = superToken) =>
        request(app.getHttpServer())
            .post('/api/admin/pages/global-sections')
            .set(auth(token))
            .send({ name: 'Global', html: '<p>global</p>' })

    beforeAll(async () => {
        context = await createE2eContext()
        app = context.app
        prisma = context.prisma
        superToken = await authenticateSuperAdmin(app)
        const password = 'pages_contract_12345'
        await prisma.user.create({
            data: {
                name: 'Pages contract admin',
                email: 'pages-contract-admin@example.com',
                password: await bcryptjs.hash(password, 10),
                can_manage_site_settings: true,
            },
        })
        adminToken = (
            await request(app.getHttpServer())
                .post('/api/user/authenticate')
                .send({ email: 'pages-contract-admin@example.com', password })
        ).body.token
    })

    beforeEach(async () => {
        await prisma.pageSectionPlacement.deleteMany()
        await prisma.sectionDefinition.deleteMany()
        await prisma.pageLayout.deleteMany()
        await seedMaterializedPages(prisma)
    })

    afterAll(async () => closeE2eContext(context))

    it('returns the exact typed registry fields to SUPER_ADMIN', async () => {
        const response = await request(app.getHttpServer()).get('/api/admin/pages/registry').set(auth())
        expect(response.status).toBe(200)
        expect(Object.keys(response.body[0]).sort()).toEqual(
            [
                'pageKey',
                'title',
                'routePattern',
                'revision',
                'totalSections',
                'visibleSections',
                'hiddenSections',
                'pageCustomHtmlSections',
                'globalCustomHtmlSections',
                'isMaterialized',
            ].sort()
        )
    })

    it('returns the exact typed page layout fields to SUPER_ADMIN', async () => {
        const response = await getLayout()
        expect(response.status).toBe(200)
        expect(Object.keys(response.body).sort()).toEqual(
            ['pageKey', 'title', 'routePattern', 'revision', 'sections'].sort()
        )
        expect(response.body.sections[0]).toEqual(
            expect.objectContaining({
                placementId: expect.any(Number),
                definitionId: expect.any(Number),
                definitionRevision: expect.any(Number),
                canToggle: true,
                canReorder: true,
            })
        )
    })

    it('creates page custom HTML with 201 and a full layout', async () => {
        const response = await createPageCustom((await getLayout()).body.revision)
        expect(response.status).toBe(201)
        expect(response.body).toMatchObject({ pageKey: 'home', sections: expect.any(Array) })
        expect(response.body.sections.some((section: any) => section.type === 'PAGE_CUSTOM_HTML')).toBe(true)
    })

    it('updates page custom HTML with 200 and a full layout', async () => {
        const created = await createPageCustom((await getLayout()).body.revision)
        const custom = created.body.sections.find((section: any) => section.type === 'PAGE_CUSTOM_HTML')
        const response = await request(app.getHttpServer())
            .patch(`/api/admin/pages/home/sections/${custom.placementId}`)
            .set(auth())
            .send({ name: 'Updated', expectedRevision: created.body.revision })
        expect(response.status).toBe(200)
        expect(response.body.sections.find((section: any) => section.placementId === custom.placementId).name).toBe(
            'Updated'
        )
    })

    it('toggles a page placement with 200 and a full layout', async () => {
        const layout = await getLayout()
        const response = await request(app.getHttpServer())
            .post(`/api/admin/pages/home/sections/${layout.body.sections[0].placementId}/toggle`)
            .set(auth())
            .send({ isVisible: false, expectedRevision: layout.body.revision })
        expect(response.status).toBe(200)
        expect(response.body.sections[0].isVisible).toBe(false)
    })

    it('reorders all placements with 200 and a full layout', async () => {
        const layout = await getLayout()
        const ids = layout.body.sections.map((section: any) => section.placementId).reverse()
        const response = await request(app.getHttpServer())
            .post('/api/admin/pages/home/sections/reorder')
            .set(auth())
            .send({ sectionIds: ids, expectedRevision: layout.body.revision })
        expect(response.status).toBe(200)
        expect(response.body.sections.map((section: any) => section.placementId)).toEqual(ids)
    })

    it('deletes page custom HTML with 200 and a full layout', async () => {
        const created = await createPageCustom((await getLayout()).body.revision)
        const custom = created.body.sections.find((section: any) => section.type === 'PAGE_CUSTOM_HTML')
        const response = await request(app.getHttpServer())
            .delete(`/api/admin/pages/home/sections/${custom.placementId}`)
            .set(auth())
            .send({ expectedRevision: created.body.revision })
        expect(response.status).toBe(200)
        expect(response.body.sections.some((section: any) => section.placementId === custom.placementId)).toBe(false)
    })

    it('creates global custom HTML with 201 and 13 affected pages', async () => {
        const response = await createGlobal()
        expect(response.status).toBe(201)
        expect(response.body.globalDefinition).toEqual(expect.objectContaining({ definitionId: expect.any(Number) }))
        expect(response.body.affectedPages).toHaveLength(13)
    })

    it('updates global custom HTML with typed fields', async () => {
        const created = await createGlobal()
        const definition = created.body.globalDefinition
        const response = await request(app.getHttpServer())
            .patch(`/api/admin/pages/global-sections/${definition.definitionId}`)
            .set(auth())
            .send({ name: 'Updated global', expectedDefinitionRevision: definition.revision })
        expect(response.status).toBe(200)
        expect(response.body).toEqual(
            expect.objectContaining({ name: 'Updated global', totalPlacements: 13, revision: definition.revision + 1 })
        )
    })

    it('deletes global custom HTML with definitionId and 13 affected pages', async () => {
        const created = await createGlobal()
        const definition = created.body.globalDefinition
        const response = await request(app.getHttpServer())
            .delete(`/api/admin/pages/global-sections/${definition.definitionId}`)
            .set(auth())
            .send({ expectedDefinitionRevision: definition.revision })
        expect(response.status).toBe(200)
        expect(response.body.definitionId).toBe(definition.definitionId)
        expect(response.body.affectedPages).toHaveLength(13)
    })

    it('returns exact stale page revision conflict', async () => {
        const layout = await getLayout()
        await createPageCustom(layout.body.revision)
        const response = await createPageCustom(layout.body.revision)
        expect(response.status).toBe(409)
        expect(response.body.message).toBe('STALE_PAGE_LAYOUT_REVISION')
    })

    it('returns exact stale global definition conflict', async () => {
        const created = await createGlobal()
        const definition = created.body.globalDefinition
        await request(app.getHttpServer())
            .patch(`/api/admin/pages/global-sections/${definition.definitionId}`)
            .set(auth())
            .send({ name: 'First', expectedDefinitionRevision: definition.revision })
        const response = await request(app.getHttpServer())
            .patch(`/api/admin/pages/global-sections/${definition.definitionId}`)
            .set(auth())
            .send({ name: 'Stale', expectedDefinitionRevision: definition.revision })
        expect(response.status).toBe(409)
        expect(response.body.message).toBe('STALE_SECTION_DEFINITION_REVISION')
    })

    it('rejects PAGE_SYSTEM update with exact code', async () => {
        const layout = await getLayout()
        const response = await request(app.getHttpServer())
            .patch(`/api/admin/pages/home/sections/${layout.body.sections[0].placementId}`)
            .set(auth())
            .send({ name: 'No', expectedRevision: layout.body.revision })
        expect(response.status).toBe(400)
        expect(response.body.message).toBe('SYSTEM_SECTION_CONTENT_IMMUTABLE')
    })

    it('rejects PAGE_SYSTEM delete with exact code', async () => {
        const layout = await getLayout()
        const response = await request(app.getHttpServer())
            .delete(`/api/admin/pages/home/sections/${layout.body.sections[0].placementId}`)
            .set(auth())
            .send({ expectedRevision: layout.body.revision })
        expect(response.status).toBe(400)
        expect(response.body.message).toBe('SYSTEM_SECTION_DELETE_FORBIDDEN')
    })

    it('rejects GLOBAL_CUSTOM placement delete from a page with exact code', async () => {
        const created = await createGlobal()
        const layout = await getLayout()
        const placement = layout.body.sections.find(
            (section: any) => section.definitionId === created.body.globalDefinition.definitionId
        )
        const response = await request(app.getHttpServer())
            .delete(`/api/admin/pages/home/sections/${placement.placementId}`)
            .set(auth())
            .send({ expectedRevision: layout.body.revision })
        expect(response.status).toBe(400)
        expect(response.body.message).toBe('GLOBAL_PLACEMENT_DELETE_FORBIDDEN')
    })

    it('allows a non-super site-settings admin to read registry/layout and toggle/reorder', async () => {
        expect((await request(app.getHttpServer()).get('/api/admin/pages/registry').set(auth(adminToken))).status).toBe(
            200
        )
        const layout = await getLayout('home', adminToken)
        expect(layout.status).toBe(200)
        const toggle = await request(app.getHttpServer())
            .post(`/api/admin/pages/home/sections/${layout.body.sections[0].placementId}/toggle`)
            .set(auth(adminToken))
            .send({ isVisible: false, expectedRevision: layout.body.revision })
        expect(toggle.status).toBe(200)
        const reorder = await request(app.getHttpServer())
            .post('/api/admin/pages/home/sections/reorder')
            .set(auth(adminToken))
            .send({
                sectionIds: toggle.body.sections.map((section: any) => section.placementId),
                expectedRevision: toggle.body.revision,
            })
        expect(reorder.status).toBe(200)
    })

    it('hides raw HTML from a non-super site-settings admin', async () => {
        await createPageCustom((await getLayout()).body.revision)
        const response = await getLayout('home', adminToken)
        const custom = response.body.sections.find((section: any) => section.type === 'PAGE_CUSTOM_HTML')
        expect(custom.html).toBeUndefined()
        expect(custom.canEditContent).toBe(false)
    })

    it('forbids non-super page custom create/update/delete', async () => {
        expect((await createPageCustom((await getLayout()).body.revision, adminToken)).status).toBe(403)
        const created = await createPageCustom((await getLayout()).body.revision)
        const custom = created.body.sections.find((section: any) => section.type === 'PAGE_CUSTOM_HTML')
        expect(
            (
                await request(app.getHttpServer())
                    .patch(`/api/admin/pages/home/sections/${custom.placementId}`)
                    .set(auth(adminToken))
                    .send({ name: 'No', expectedRevision: created.body.revision })
            ).status
        ).toBe(403)
        expect(
            (
                await request(app.getHttpServer())
                    .delete(`/api/admin/pages/home/sections/${custom.placementId}`)
                    .set(auth(adminToken))
                    .send({ expectedRevision: created.body.revision })
            ).status
        ).toBe(403)
    })

    it('forbids non-super global create/update/delete', async () => {
        expect((await createGlobal(adminToken)).status).toBe(403)
        const created = await createGlobal()
        const definition = created.body.globalDefinition
        expect(
            (
                await request(app.getHttpServer())
                    .patch(`/api/admin/pages/global-sections/${definition.definitionId}`)
                    .set(auth(adminToken))
                    .send({ name: 'No', expectedDefinitionRevision: definition.revision })
            ).status
        ).toBe(403)
        expect(
            (
                await request(app.getHttpServer())
                    .delete(`/api/admin/pages/global-sections/${definition.definitionId}`)
                    .set(auth(adminToken))
                    .send({ expectedDefinitionRevision: definition.revision })
            ).status
        ).toBe(403)
    })

    it('returns a public layout without authentication', async () => {
        const response = await request(app.getHttpServer()).get('/api/public/pages/home/layout')
        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({ pageKey: 'home', sections: expect.any(Array) })
    })

    it('omits hidden public placements', async () => {
        const placement = await prisma.pageSectionPlacement.findFirstOrThrow({ where: { page_key: 'home' } })
        await prisma.pageSectionPlacement.update({ where: { id: placement.id }, data: { is_visible: false } })
        const response = await request(app.getHttpServer()).get('/api/public/pages/home/layout')
        expect(response.body.sections.some((section: any) => section.key === 'home.hero')).toBe(false)
    })

    it('returns public sections in deterministic sort order', async () => {
        const layout = await prisma.pageLayout.findUniqueOrThrow({ where: { page_key: 'home' } })
        await prisma.pageSectionPlacement.updateMany({ where: { page_layout_id: layout.id }, data: { sort_order: 7 } })
        const expected = await prisma.pageSectionPlacement.findMany({
            where: { page_layout_id: layout.id },
            orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
            include: { section_definition: true },
        })
        const response = await request(app.getHttpServer()).get('/api/public/pages/home/layout')
        expect(response.body.sections.map((section: any) => section.key)).toEqual(
            expected.map(row => row.section_definition.key)
        )
    })

    it('returns 404 for an unknown public page key', async () => {
        expect((await request(app.getHttpServer()).get('/api/public/pages/unknown/layout')).status).toBe(404)
    })

    it('publishes complete typed PagesController OpenAPI schemas', async () => {
        const response = await request(app.getHttpServer()).get('/api/docs-json')
        expect(response.status).toBe(200)
        const document = response.body
        const operations = Object.entries(document.paths)
            .flatMap(([path, methods]: [string, any]) =>
                Object.values(methods).map((operation: any) => ({ path, operation }))
            )
            .filter(({ operation }) => operation.tags?.includes('Page Layouts'))
        for (const { operation } of operations) {
            const success = operation.responses['200'] ?? operation.responses['201']
            expect(success?.content?.['application/json']?.schema).toBeDefined()
            for (const status of ['400', '403', '404', '409']) {
                const schema = operation.responses[status]?.content?.['application/json']?.schema
                if (schema) expect(schema.$ref).toBe('#/components/schemas/PageErrorResponseDto')
            }
        }
        const paths = document.paths
        expect(
            paths['/api/admin/pages/{pageKey}/sections/{placementId}'].delete.requestBody.content['application/json']
                .schema.$ref
        ).toContain('DeletePageSectionDto')
        expect(
            paths['/api/admin/pages/{pageKey}/sections/{placementId}/toggle'].post.requestBody.content[
                'application/json'
            ].schema.$ref
        ).toContain('TogglePageSectionDto')
        expect(
            paths['/api/admin/pages/global-sections/{definitionId}'].delete.requestBody.content['application/json']
                .schema.$ref
        ).toContain('DeleteGlobalHtmlSectionDto')
        expect(
            paths['/api/admin/pages/registry'].get.responses['200'].content['application/json'].schema.items.$ref
        ).toContain('PageRegistrySummaryDto')
        expect(
            paths['/api/admin/pages/{pageKey}/layout'].get.responses['200'].content['application/json'].schema.$ref
        ).toContain('AdminPageLayoutResponseDto')
        expect(
            paths['/api/admin/pages/global-sections'].post.responses['201'].content['application/json'].schema.$ref
        ).toContain('CreateGlobalHtmlSectionResponseDto')
        expect(
            paths['/api/admin/pages/global-sections/{definitionId}'].delete.responses['200'].content['application/json']
                .schema.$ref
        ).toContain('DeleteGlobalHtmlSectionResponseDto')
    })
})
