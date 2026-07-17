import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'

import { closeE2eContext, createE2eContext } from './helpers/e2e-context'

jest.setTimeout(30000)

describe('Simple admin permissions (e2e)', () => {
    let app: INestApplication
    let context: Awaited<ReturnType<typeof createE2eContext>>
    let superToken: string
    let superId: number
    let adminId: number
    let adminToken: string

    beforeAll(async () => {
        context = await createE2eContext()
        app = context.app
        const auth = await request(app.getHttpServer())
            .post('/api/user/authenticate')
            .send({
                email: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
                password: process.env.SUPER_ADMIN_PASSWORD || 'change_me_12345',
            })
        superToken = auth.body.token
        const me = await request(app.getHttpServer()).get('/api/user/me').set('Authorization', `Bearer ${superToken}`)
        superId = me.body.id
        const created = await request(app.getHttpServer())
            .post('/api/user/admin/users')
            .set('Authorization', `Bearer ${superToken}`)
            .send({
                name: 'Content Admin',
                email: 'content@example.com',
                password: 'change_me_12345',
                role: 'ADMIN',
                isActive: true,
                canManageNews: true,
                canManageSiteSettings: false,
                documentsAccessMode: 'SELECTED_GROUPS',
                documentGroups: ['GIA_9'],
            })
        adminId = created.body.id
        const adminAuth = await request(app.getHttpServer()).post('/api/user/authenticate').send({
            email: 'content@example.com',
            password: 'change_me_12345',
        })
        adminToken = adminAuth.body.token
    })

    afterAll(() => closeE2eContext(context))

    it('closes public registration', async () => {
        expect((await request(app.getHttpServer()).post('/api/user/register').send({})).status).toBe(404)
    })

    it('returns only the new runtime permission model', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/user/me')
            .set('Authorization', `Bearer ${adminToken}`)
        expect(response.status).toBe(200)
        expect(response.body).toEqual(
            expect.objectContaining({
                role: 'ADMIN',
                isActive: true,
                canManageNews: true,
                canManageSiteSettings: false,
                documentsAccessMode: 'SELECTED_GROUPS',
                documentGroups: ['GIA_9'],
            })
        )
        expect(response.body.permissions).toBeUndefined()
    })

    it('enforces capabilities and selected document groups', async () => {
        expect(
            (await request(app.getHttpServer()).get('/api/admin/news').set('Authorization', `Bearer ${adminToken}`))
                .status
        ).toBe(200)
        expect(
            (
                await request(app.getHttpServer())
                    .get('/api/admin/site-settings')
                    .set('Authorization', `Bearer ${adminToken}`)
            ).status
        ).toBe(403)
        expect(
            (
                await request(app.getHttpServer())
                    .get('/api/admin/documents?placementKey=gia-9.normative-documents')
                    .set('Authorization', `Bearer ${adminToken}`)
            ).status
        ).toBe(200)
        expect(
            (
                await request(app.getHttpServer())
                    .get('/api/admin/documents?placementKey=gia-11.normative-documents')
                    .set('Authorization', `Bearer ${adminToken}`)
            ).status
        ).toBe(403)
    })

    it('invalidates an existing session when the admin is deactivated', async () => {
        const update = await request(app.getHttpServer())
            .patch(`/api/user/admin/users/${adminId}`)
            .set('Authorization', `Bearer ${superToken}`)
            .send({ isActive: false })
        expect(update.status).toBe(200)
        expect(
            (await request(app.getHttpServer()).get('/api/user/me').set('Authorization', `Bearer ${adminToken}`)).status
        ).toBe(401)
        expect(
            (
                await request(app.getHttpServer())
                    .post('/api/user/authenticate')
                    .send({ email: 'content@example.com', password: 'change_me_12345' })
            ).status
        ).toBe(400)
    })

    it('transactionally protects the last active SUPER_ADMIN from deactivation or demotion', async () => {
        const deactivate = await request(app.getHttpServer())
            .patch(`/api/user/admin/users/${superId}`)
            .set('Authorization', `Bearer ${superToken}`)
            .send({ isActive: false })
        expect(deactivate.status).toBe(400)
        const demote = await request(app.getHttpServer())
            .patch(`/api/user/admin/users/${superId}`)
            .set('Authorization', `Bearer ${superToken}`)
            .send({ role: 'ADMIN' })
        expect(demote.status).toBe(400)
    })
})
