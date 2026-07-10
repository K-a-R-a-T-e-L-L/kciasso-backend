import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'

import { closeE2eContext, createE2eContext } from './helpers/e2e-context'

jest.setTimeout(30000)

describe('Auth foundation (e2e)', () => {
    let app: INestApplication
    let context: Awaited<ReturnType<typeof createE2eContext>>

    beforeAll(async () => {
        context = await createE2eContext()
        app = context.app
    })

    afterAll(async () => {
        await closeE2eContext(context)
    })

    it('allows super-admin to authenticate', async () => {
        const response = await request(app.getHttpServer()).post('/api/user/authenticate').send({
            email: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
            password: process.env.SUPER_ADMIN_PASSWORD || 'change_me_12345',
        })

        expect(response.status).toBe(201)
        expect(response.body).toEqual(
            expect.objectContaining({
                id: expect.any(Number),
                token: expect.any(String),
                user_id: expect.any(Number),
            })
        )
    })

    it('returns safe current user dto without password', async () => {
        const authResponse = await request(app.getHttpServer()).post('/api/user/authenticate').send({
            email: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
            password: process.env.SUPER_ADMIN_PASSWORD || 'change_me_12345',
        })

        const meResponse = await request(app.getHttpServer())
            .get('/api/user/me')
            .set('Authorization', `Bearer ${authResponse.body.token}`)

        expect(meResponse.status).toBe(200)
        expect(meResponse.body).toEqual(
            expect.objectContaining({
                id: expect.any(Number),
                name: expect.any(String),
                email: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
                isSuperAdmin: true,
                permissions: expect.any(Array),
            })
        )
        expect(meResponse.body.password).toBeUndefined()
    })

    it('keeps swagger docs and current user schema consistent', async () => {
        const docsResponse = await request(app.getHttpServer()).get('/api/docs')
        const docsJsonResponse = await request(app.getHttpServer()).get('/api/docs-json')

        expect(docsResponse.status).toBe(200)
        expect(docsJsonResponse.status).toBe(200)
        expect(docsJsonResponse.body.paths['/api/user/me']).toBeDefined()
        expect(docsJsonResponse.body.paths['/api/user/admin/users']).toBeDefined()
        expect(docsJsonResponse.body.paths['/api/user/authenticate']).toBeDefined()

        const currentUserDtoSchema = docsJsonResponse.body.components.schemas.CurrentUserDto

        expect(currentUserDtoSchema.properties.password).toBeUndefined()
        expect(currentUserDtoSchema.properties.permissions.type).toBe('array')
        expect(currentUserDtoSchema.properties.permissions.items.type).toBe('string')
    })
})
