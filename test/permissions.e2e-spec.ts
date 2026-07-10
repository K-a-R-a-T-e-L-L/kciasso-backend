import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'

import { closeE2eContext, createE2eContext } from './helpers/e2e-context'

jest.setTimeout(30000)

describe('Permissions foundation (e2e)', () => {
    let app: INestApplication
    let context: Awaited<ReturnType<typeof createE2eContext>>
    let superAdminToken: string
    let editorToken: string
    let editorUserId: number
    let regularUserToken: string
    let createdUserId: number

    beforeAll(async () => {
        context = await createE2eContext()
        app = context.app

        const superAdminAuthResponse = await request(app.getHttpServer()).post('/api/user/authenticate').send({
            email: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
            password: process.env.SUPER_ADMIN_PASSWORD || 'change_me_12345',
        })

        superAdminToken = superAdminAuthResponse.body.token

        const registerResponse = await request(app.getHttpServer()).post('/api/user/register').send({
            name: 'Editor User',
            email: 'editor@example.com',
            password: 'change_me_12345',
        })

        editorToken = registerResponse.body.token

        const regularUserResponse = await request(app.getHttpServer()).post('/api/user/register').send({
            name: 'Regular User',
            email: 'regular@example.com',
            password: 'change_me_12345',
        })

        regularUserToken = regularUserResponse.body.token

        const usersResponse = await request(app.getHttpServer())
            .get('/api/user/admin/users')
            .set('Authorization', `Bearer ${superAdminToken}`)

        editorUserId = usersResponse.body.find((user: { email: string }) => user.email === 'editor@example.com').id
    })

    afterAll(async () => {
        await closeE2eContext(context)
    })

    it('allows super-admin to access admin users list', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/user/admin/users')
            .set('Authorization', `Bearer ${superAdminToken}`)

        expect(response.status).toBe(200)
        expect(Array.isArray(response.body)).toBe(true)
        expect(response.body.length).toBeGreaterThanOrEqual(2)
    })

    it('rejects ordinary user on super-admin endpoint', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/user/admin/users')
            .set('Authorization', `Bearer ${editorToken}`)

        expect(response.status).toBe(403)
        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 403,
                error: 'Forbidden',
                errorMessage: 'NOT_ENOUGH_RIGHTS',
            })
        )
    })

    it('allows super-admin to assign permissions to ordinary user', async () => {
        const response = await request(app.getHttpServer())
            .patch(`/api/user/admin/users/${editorUserId}/permissions`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                sectionIds: ['news', 'gia-9.normative-documents'],
            })

        expect(response.status).toBe(200)
        expect(response.body.permissions).toEqual(['gia-9.normative-documents', 'news'])
    })

    it('allows super-admin to create subordinate admin', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/user/admin/users')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                name: 'Julia Editor',
                email: 'julia@example.com',
                password: 'change_me_12345',
                isSuperAdmin: false,
                sectionIds: ['news'],
            })

        expect(response.status).toBe(201)
        expect(response.body).toEqual(
            expect.objectContaining({
                id: expect.any(Number),
                name: 'Julia Editor',
                email: 'julia@example.com',
                isSuperAdmin: false,
                permissions: ['news'],
            })
        )
        expect(response.body.password).toBeUndefined()
        createdUserId = response.body.id
    })

    it('created subordinate admin can authenticate', async () => {
        const response = await request(app.getHttpServer()).post('/api/user/authenticate').send({
            email: 'julia@example.com',
            password: 'change_me_12345',
        })

        expect(response.status).toBe(201)
        expect(response.body.token).toEqual(expect.any(String))
    })

    it('returns subordinate admin permissions after creation', async () => {
        const response = await request(app.getHttpServer())
            .get(`/api/user/admin/users/${createdUserId}/permissions`)
            .set('Authorization', `Bearer ${superAdminToken}`)

        expect(response.status).toBe(200)
        expect(response.body.permissions).toEqual(['news'])
    })

    it('rejects ordinary user when trying to create other users', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/user/admin/users')
            .set('Authorization', `Bearer ${regularUserToken}`)
            .send({
                name: 'Forbidden User',
                email: 'forbidden@example.com',
                password: 'change_me_12345',
                sectionIds: ['news'],
            })

        expect(response.status).toBe(403)
        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 403,
                errorMessage: 'NOT_ENOUGH_RIGHTS',
            })
        )
    })

    it('returns clear error for duplicate admin email', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/user/admin/users')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                name: 'Julia Duplicate',
                email: 'julia@example.com',
                password: 'change_me_12345',
                sectionIds: ['news'],
            })

        expect(response.status).toBe(400)
        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 400,
                errorMessage: 'EMAIL_ALREADY_IN_USE',
            })
        )
    })

    it('returns sections list for super-admin', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/user/admin/sections')
            .set('Authorization', `Bearer ${superAdminToken}`)

        expect(response.status).toBe(200)
        expect(Array.isArray(response.body)).toBe(true)
        expect(response.body.some((section: { sectionId: string }) => section.sectionId === 'news')).toBe(true)
    })

    it('allows super-admin to delete subordinate admin', async () => {
        const response = await request(app.getHttpServer())
            .delete(`/api/user/admin/users/${createdUserId}`)
            .set('Authorization', `Bearer ${superAdminToken}`)

        expect(response.status).toBe(200)
        expect(response.body).toEqual(
            expect.objectContaining({
                id: createdUserId,
                permissions: [],
            })
        )
    })

    it('prevents deleted admin from authenticating again', async () => {
        const response = await request(app.getHttpServer()).post('/api/user/authenticate').send({
            email: 'julia@example.com',
            password: 'change_me_12345',
        })

        expect(response.status).toBe(400)
        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 400,
                errorMessage: 'AUTH_FAIL',
            })
        )
    })

    it('rejects deleting own super-admin account', async () => {
        const usersResponse = await request(app.getHttpServer())
            .get('/api/user/admin/users')
            .set('Authorization', `Bearer ${superAdminToken}`)

        const currentSuperAdminId = usersResponse.body.find(
            (user: { email: string }) => user.email === (process.env.SUPER_ADMIN_EMAIL || 'admin@example.com')
        ).id

        const response = await request(app.getHttpServer())
            .delete(`/api/user/admin/users/${currentSuperAdminId}`)
            .set('Authorization', `Bearer ${superAdminToken}`)

        expect(response.status).toBe(400)
        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 400,
                errorMessage: 'INVALID_QUERY_STRING',
            })
        )
    })

    it('returns clear error for unknown section id', async () => {
        const response = await request(app.getHttpServer())
            .patch(`/api/user/admin/users/${editorUserId}/permissions`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                sectionIds: ['news', 'missing.section'],
            })

        expect(response.status).toBe(404)
        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 404,
                error: 'Not Found',
                errorMessage: 'ENTITY_NOT_FOUND',
                description: 'Unknown sectionIds: missing.section',
            })
        )
    })
})
