import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'

import { closeE2eContext, createE2eContext } from './helpers/e2e-context'

jest.setTimeout(60000)

describe('News automatic order and slug (e2e)', () => {
    let app: INestApplication
    let context: Awaited<ReturnType<typeof createE2eContext>>
    let token: string

    beforeAll(async () => {
        context = await createE2eContext()
        app = context.app
        token = (
            await request(app.getHttpServer())
                .post('/api/user/authenticate')
                .send({
                    email: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
                    password: process.env.SUPER_ADMIN_PASSWORD || 'change_me_12345',
                })
        ).body.token
    })

    afterAll(async () => closeE2eContext(context))

    it('appends categories transactionally and generates unique slugs', async () => {
        const responses = await Promise.all(
            ['Качество образования', 'Качество образования'].map(title =>
                request(app.getHttpServer())
                    .post('/api/admin/news-categories')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ title, isActive: true })
            )
        )

        expect(responses.every(response => response.status === 201)).toBe(true)
        const created = responses.map(response => response.body)
        expect(created.map(item => item.slug).sort()).toEqual(['kachestvo-obrazovaniya', 'kachestvo-obrazovaniya-2'])
        expect(Math.abs(created[0].order - created[1].order)).toBe(1)

        const explicit = await request(app.getHttpServer())
            .post('/api/admin/news-categories')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Явный порядок', slug: 'Ручной slug', order: 77 })
        expect(explicit.status).toBe(201)
        expect(explicit.body.slug).toBe('ruchnoy-slug')
        expect(explicit.body.order).toBe(77)
        const updated = await request(app.getHttpServer())
            .patch(`/api/admin/news-categories/${explicit.body.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Изменённое название' })
        expect(updated.body.order).toBe(77)
        expect(updated.body.slug).toBe('ruchnoy-slug')
    })

    it('generates a news slug, preserves it on title update, and supports public lookup', async () => {
        const categories = await request(app.getHttpServer())
            .get('/api/admin/news-categories')
            .set('Authorization', `Bearer ${token}`)
        const categoryId = categories.body[0].id
        const created = await request(app.getHttpServer())
            .post('/api/admin/news')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Результаты ЕГЭ 2026', excerpt: 'Коротко', content: 'Текст', categoryId, isPublished: true })

        expect(created.status).toBe(201)
        expect(created.body.slug).toBe('rezultaty-ege-2026')
        const updated = await request(app.getHttpServer())
            .patch(`/api/admin/news/${created.body.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Другой заголовок' })
        expect(updated.body.slug).toBe('rezultaty-ege-2026')
        expect((await request(app.getHttpServer()).get('/api/public/news/rezultaty-ege-2026')).status).toBe(200)
    })

    it('treats an explicitly empty slug as omitted', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/admin/news')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Empty slug form value', slug: '', excerpt: 'Короткое', content: 'Текст' })

        expect(response.status).toBe(201)
        expect(response.body.slug).toBe('empty-slug-form-value')
    })

    it('rejects duplicate manual slug with a Russian error', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/admin/news-categories')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Другая рубрика', slug: 'kachestvo-obrazovaniya' })
        expect(response.status).toBe(400)
        expect(JSON.stringify(response.body)).toContain('slug')
    })
})
