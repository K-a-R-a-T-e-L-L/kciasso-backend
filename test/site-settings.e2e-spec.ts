import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'

import { closeE2eContext, createE2eContext } from './helpers/e2e-context'

jest.setTimeout(30000)

describe('Site settings module (e2e)', () => {
    let app: INestApplication
    let context: Awaited<ReturnType<typeof createE2eContext>>
    let superAdminToken: string
    let editorWithoutPermissionToken: string
    let editorWithPermissionToken: string

    beforeAll(async () => {
        context = await createE2eContext()
        app = context.app

        const superAdminAuthResponse = await request(app.getHttpServer())
            .post('/api/user/authenticate')
            .send({
                email: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
                password: process.env.SUPER_ADMIN_PASSWORD || 'change_me_12345',
            })
        superAdminToken = superAdminAuthResponse.body.token

        for (const [name, email, canManageSiteSettings] of [
            ['Settings Viewer', 'settings-no-permission@example.com', false],
            ['Settings Editor', 'settings-with-permission@example.com', true],
        ] as const) {
            await request(app.getHttpServer())
                .post('/api/user/admin/users')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send({
                    name,
                    email,
                    password: 'change_me_12345',
                    role: 'ADMIN',
                    isActive: true,
                    canManageNews: false,
                    canManageSiteSettings,
                    documentsAccessMode: 'NONE',
                    documentGroups: [],
                })
        }
        editorWithoutPermissionToken = (
            await request(app.getHttpServer())
                .post('/api/user/authenticate')
                .send({ email: 'settings-no-permission@example.com', password: 'change_me_12345' })
        ).body.token
        editorWithPermissionToken = (
            await request(app.getHttpServer())
                .post('/api/user/authenticate')
                .send({ email: 'settings-with-permission@example.com', password: 'change_me_12345' })
        ).body.token
    })

    afterAll(async () => {
        await closeE2eContext(context)
    })

    it('allows public access without token', async () => {
        const response = await request(app.getHttpServer()).get('/api/public/site-settings')

        expect(response.status).toBe(200)
    })

    it('returns all four public contact fields', async () => {
        const response = await request(app.getHttpServer()).get('/api/public/site-settings')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
            giaHotlinePhone: '8 (3842) 587025',
            informationPhone: '8 (495) 198-92-38',
            egeTrustPhone: '8 (495) 198-93-38',
            email: 'info@kcias.ru',
            homeSectionsOrder: ['home.quick-access', 'home.resources', 'home.gia-reference', 'home.official-resources'],
        })
    })

    it('returns the default home section order publicly', async () => {
        const response = await request(app.getHttpServer()).get('/api/public/site-settings')

        expect(response.body.homeSectionsOrder).toEqual([
            'home.quick-access',
            'home.resources',
            'home.gia-reference',
            'home.official-resources',
        ])
    })

    it('allows super-admin to read settings', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/admin/site-settings')
            .set('Authorization', `Bearer ${superAdminToken}`)

        expect(response.status).toBe(200)
        expect(response.body.createdAt).toBeTruthy()
        expect(response.body.updatedAt).toBeTruthy()
    })

    it('allows super-admin to update settings', async () => {
        const response = await request(app.getHttpServer())
            .patch('/api/admin/site-settings')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                giaHotlinePhone: '+7 (3842) 111-222',
                email: 'support@kcias.ru',
            })

        expect(response.status).toBe(200)
        expect(response.body).toEqual(
            expect.objectContaining({
                giaHotlinePhone: '+7 (3842) 111-222',
                informationPhone: '8 (495) 198-92-38',
                egeTrustPhone: '8 (495) 198-93-38',
                email: 'support@kcias.ru',
            })
        )
    })

    it('returns 403 for subordinate admin without permission', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/admin/site-settings')
            .set('Authorization', `Bearer ${editorWithoutPermissionToken}`)

        expect(response.status).toBe(403)
    })

    it('allows subordinate admin with permission to read and update settings', async () => {
        const getResponse = await request(app.getHttpServer())
            .get('/api/admin/site-settings')
            .set('Authorization', `Bearer ${editorWithPermissionToken}`)

        expect(getResponse.status).toBe(200)

        const patchResponse = await request(app.getHttpServer())
            .patch('/api/admin/site-settings')
            .set('Authorization', `Bearer ${editorWithPermissionToken}`)
            .send({
                informationPhone: '+7 (495) 000-00-01',
            })

        expect(patchResponse.status).toBe(200)
        expect(patchResponse.body.informationPhone).toBe('+7 (495) 000-00-01')
    })

    it('rejects invalid email', async () => {
        const response = await request(app.getHttpServer())
            .patch('/api/admin/site-settings')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                email: 'not-an-email',
            })

        expect(response.status).toBe(400)
    })

    it('rejects empty phone', async () => {
        const response = await request(app.getHttpServer())
            .patch('/api/admin/site-settings')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                giaHotlinePhone: '   ',
            })

        expect(response.status).toBe(400)
    })

    it.each([
        ['unknown key', ['home.quick-access', 'home.resources', 'home.gia-reference', 'home.unknown']],
        ['duplicate key', ['home.quick-access', 'home.resources', 'home.gia-reference', 'home.gia-reference']],
        ['incomplete array', ['home.quick-access', 'home.resources', 'home.gia-reference']],
    ])('rejects %s home section order', async (_, homeSectionsOrder) => {
        const response = await request(app.getHttpServer())
            .patch('/api/admin/site-settings')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ homeSectionsOrder })

        expect(response.status).toBe(400)
    })

    it('accepts a valid home section permutation and preserves contacts', async () => {
        const homeSectionsOrder = [
            'home.gia-reference',
            'home.quick-access',
            'home.official-resources',
            'home.resources',
        ]
        const response = await request(app.getHttpServer())
            .patch('/api/admin/site-settings')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ homeSectionsOrder })

        expect(response.status).toBe(200)
        expect(response.body.homeSectionsOrder).toEqual(homeSectionsOrder)
        expect(response.body.email).toBe('support@kcias.ru')
    })

    it('keeps singleton row count stable after patch requests', async () => {
        const before = await context.prisma.siteSettings.findMany()

        await request(app.getHttpServer())
            .patch('/api/admin/site-settings')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                egeTrustPhone: '+7 (495) 000-00-02',
            })

        const after = await context.prisma.siteSettings.findMany()

        expect(before).toHaveLength(1)
        expect(after).toHaveLength(1)
        expect(after[0].id).toBe(before[0].id)
    })

    it('returns updated values from public endpoint after admin changes', async () => {
        const response = await request(app.getHttpServer()).get('/api/public/site-settings')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
            giaHotlinePhone: '+7 (3842) 111-222',
            informationPhone: '+7 (495) 000-00-01',
            egeTrustPhone: '+7 (495) 000-00-02',
            email: 'support@kcias.ru',
            homeSectionsOrder: ['home.gia-reference', 'home.quick-access', 'home.official-resources', 'home.resources'],
        })
    })

    it('accepts formatted Russian phone values and preserves them', async () => {
        const response = await request(app.getHttpServer())
            .patch('/api/admin/site-settings')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                giaHotlinePhone: '8 (3842) 587025',
                informationPhone: '8 (495) 198-92-38',
                egeTrustPhone: '8 (495) 198-93-38',
                email: 'support@kcias.ru',
                homeSectionsOrder: [
                    'home.quick-access',
                    'home.resources',
                    'home.gia-reference',
                    'home.official-resources',
                ],
            })

        expect(response.status).toBe(200)
        expect(response.body.giaHotlinePhone).toBe('8 (3842) 587025')
        expect(response.body.informationPhone).toBe('8 (495) 198-92-38')
        expect(response.body.egeTrustPhone).toBe('8 (495) 198-93-38')
    })

    it('accepts non-breaking spaces without changing the display value', async () => {
        const value = '8\u00a0(495)\u00a0198-92-38'
        const response = await request(app.getHttpServer())
            .patch('/api/admin/site-settings')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ informationPhone: value })

        expect(response.status).toBe(200)
        expect(response.body.informationPhone).toBe(value.replace(/\u00a0/g, ' '))
    })

    it.each(['abc', '123', '8 (495) 198-92-3a', '899999999999999'])('rejects invalid phone value %s', async value => {
        const response = await request(app.getHttpServer())
            .patch('/api/admin/site-settings')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ giaHotlinePhone: value })

        expect(response.status).toBe(400)
    })
})
