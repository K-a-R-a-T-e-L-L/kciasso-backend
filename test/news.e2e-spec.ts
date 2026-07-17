import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'

import { closeE2eContext, createE2eContext } from './helpers/e2e-context'

jest.setTimeout(30000)

describe('News module (e2e)', () => {
    let app: INestApplication
    let context: Awaited<ReturnType<typeof createE2eContext>>
    let superAdminToken: string
    let editorWithoutPermissionToken: string
    let editorWithPermissionToken: string
    let activeCategoryId: number
    let softDeletedSlug: string
    let scheduledNewsSlug: string
    let alreadyPublishedSlug: string
    let draftNewsSlug: string
    let emptyCategoryId: number

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

        for (const [name, email, canManageNews] of [
            ['Editor Without Permission', 'editor-no-news@example.com', false],
            ['Editor With Permission', 'editor-with-news@example.com', true],
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
                    canManageNews,
                    canManageSiteSettings: false,
                    documentsAccessMode: 'NONE',
                    documentGroups: [],
                })
        }
        editorWithoutPermissionToken = (
            await request(app.getHttpServer())
                .post('/api/user/authenticate')
                .send({ email: 'editor-no-news@example.com', password: 'change_me_12345' })
        ).body.token
        editorWithPermissionToken = (
            await request(app.getHttpServer())
                .post('/api/user/authenticate')
                .send({ email: 'editor-with-news@example.com', password: 'change_me_12345' })
        ).body.token

        const categoriesResponse = await request(app.getHttpServer())
            .get('/api/admin/news-categories')
            .set('Authorization', `Bearer ${superAdminToken}`)
        activeCategoryId = categoriesResponse.body.find((category: { slug: string }) => category.slug === 'gia').id
    })

    afterAll(async () => {
        await closeE2eContext(context)
    })

    it('returns only published news in public list', async () => {
        const response = await request(app.getHttpServer()).get('/api/public/news')

        expect(response.status).toBe(200)
        expect(response.body.items.length).toBeGreaterThan(0)
        expect(response.body.items.some((item: { slug: string }) => item.slug === 'seminar-dlya-spetsialistov')).toBe(
            false
        )
        expect(response.body.meta).toEqual(
            expect.objectContaining({
                page: 1,
                limit: 10,
                total: expect.any(Number),
                totalPages: expect.any(Number),
            })
        )
    })

    it('returns published news by slug', async () => {
        const response = await request(app.getHttpServer()).get('/api/public/news/materialy-gia-po-razdelam')

        expect(response.status).toBe(200)
        expect(response.body).toEqual(
            expect.objectContaining({
                slug: 'materialy-gia-po-razdelam',
                title: expect.any(String),
                content: expect.any(String),
            })
        )
    })

    it('returns 404 for unpublished news in public detail', async () => {
        const response = await request(app.getHttpServer()).get('/api/public/news/seminar-dlya-spetsialistov')

        expect(response.status).toBe(404)
    })

    it('hides scheduled news from public API until publication date', async () => {
        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
        const createResponse = await request(app.getHttpServer())
            .post('/api/admin/news')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                title: 'Scheduled news item',
                slug: 'scheduled-news-item',
                excerpt: 'This news should remain hidden until publication date.',
                content: 'Scheduled content.',
                categoryId: activeCategoryId,
                isPublished: true,
                publishedAt: futureDate.toISOString(),
            })

        expect(createResponse.status).toBe(201)
        expect(createResponse.body.status).toBe('scheduled')
        scheduledNewsSlug = createResponse.body.slug

        const listResponse = await request(app.getHttpServer()).get('/api/public/news')
        expect(listResponse.status).toBe(200)
        expect(listResponse.body.items.some((item: { slug: string }) => item.slug === scheduledNewsSlug)).toBe(false)

        const detailResponse = await request(app.getHttpServer()).get(`/api/public/news/${scheduledNewsSlug}`)
        expect(detailResponse.status).toBe(404)
    })

    it('shows published news when publishedAt is in the past and isPublished is true', async () => {
        const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const createResponse = await request(app.getHttpServer())
            .post('/api/admin/news')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                title: 'Already published news item',
                slug: 'already-published-news-item',
                excerpt: 'This news should be visible immediately.',
                content: 'Published content.',
                categoryId: activeCategoryId,
                isPublished: true,
                publishedAt: pastDate.toISOString(),
            })

        expect(createResponse.status).toBe(201)
        expect(createResponse.body.status).toBe('published')
        alreadyPublishedSlug = createResponse.body.slug

        const listResponse = await request(app.getHttpServer()).get('/api/public/news')
        expect(listResponse.status).toBe(200)
        expect(listResponse.body.items.some((item: { slug: string }) => item.slug === alreadyPublishedSlug)).toBe(true)

        const detailResponse = await request(app.getHttpServer()).get(`/api/public/news/${alreadyPublishedSlug}`)
        expect(detailResponse.status).toBe(200)
    })

    it('keeps drafts hidden from public API', async () => {
        const createResponse = await request(app.getHttpServer())
            .post('/api/admin/news')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                title: 'Draft news item',
                slug: 'draft-news-item',
                excerpt: 'Draft should remain hidden.',
                content: 'Draft content.',
                categoryId: activeCategoryId,
                isPublished: false,
            })

        expect(createResponse.status).toBe(201)
        expect(createResponse.body.status).toBe('draft')
        draftNewsSlug = createResponse.body.slug

        const listResponse = await request(app.getHttpServer()).get('/api/public/news')
        expect(listResponse.status).toBe(200)
        expect(listResponse.body.items.some((item: { slug: string }) => item.slug === draftNewsSlug)).toBe(false)

        const detailResponse = await request(app.getHttpServer()).get(`/api/public/news/${draftNewsSlug}`)
        expect(detailResponse.status).toBe(404)
    })

    it('returns active categories in public API', async () => {
        const response = await request(app.getHttpServer()).get('/api/public/news-categories')

        expect(response.status).toBe(200)
        expect(Array.isArray(response.body)).toBe(true)
        expect(response.body.some((category: { slug: string }) => category.slug === 'gia')).toBe(true)
    })

    it('allows creating and deleting empty category', async () => {
        const createResponse = await request(app.getHttpServer())
            .post('/api/admin/news-categories')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                title: 'Temporary category',
                slug: 'temporary-category',
                description: 'Disposable category for delete test.',
                order: 50,
                isActive: true,
            })

        expect(createResponse.status).toBe(201)
        expect(createResponse.body.newsCount).toBe(0)
        emptyCategoryId = createResponse.body.id

        const deleteResponse = await request(app.getHttpServer())
            .delete(`/api/admin/news-categories/${emptyCategoryId}`)
            .set('Authorization', `Bearer ${superAdminToken}`)

        expect(deleteResponse.status).toBe(200)
        expect(deleteResponse.body.id).toBe(emptyCategoryId)
    })

    it('rejects deleting category that is already used by news', async () => {
        const response = await request(app.getHttpServer())
            .delete(`/api/admin/news-categories/${activeCategoryId}`)
            .set('Authorization', `Bearer ${superAdminToken}`)

        expect(response.status).toBe(400)
        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 400,
                errorMessage: 'INVALID_QUERY_STRING',
            })
        )
    })

    it('forbids news creation without news permission', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/admin/news')
            .set('Authorization', `Bearer ${editorWithoutPermissionToken}`)
            .send({
                title: 'Запрещённая новость',
                slug: 'zapreshchennaya-novost',
                excerpt: 'Попытка без permission.',
                content: 'Контент без права доступа.',
                categoryId: activeCategoryId,
                isPublished: true,
            })

        expect(response.status).toBe(403)
    })

    it('allows user with news permission to create news', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/admin/news')
            .set('Authorization', `Bearer ${editorWithPermissionToken}`)
            .send({
                title: 'Новость редактора',
                slug: 'novost-redaktora',
                excerpt: 'Новость, созданная пользователем с permission news.',
                content: 'Подробный контент новости редактора.',
                categoryId: activeCategoryId,
                isPublished: true,
            })

        expect(response.status).toBe(201)
        expect(response.body.slug).toBe('novost-redaktora')
        expect(response.body.author.email).toBe('editor-with-news@example.com')
    })

    it('allows super-admin to create, update and soft-delete news', async () => {
        const createResponse = await request(app.getHttpServer())
            .post('/api/admin/news')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                title: 'Новость супер-админа',
                slug: 'novost-super-admina',
                excerpt: 'Создано super-admin.',
                content: 'Контент новости super-admin.',
                categoryId: activeCategoryId,
                isPublished: true,
            })

        expect(createResponse.status).toBe(201)

        const updateResponse = await request(app.getHttpServer())
            .patch(`/api/admin/news/${createResponse.body.id}`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                title: 'Обновлённая новость супер-админа',
            })

        expect(updateResponse.status).toBe(200)
        expect(updateResponse.body.title).toBe('Обновлённая новость супер-админа')

        const deleteResponse = await request(app.getHttpServer())
            .delete(`/api/admin/news/${createResponse.body.id}`)
            .set('Authorization', `Bearer ${superAdminToken}`)

        expect(deleteResponse.status).toBe(200)
        expect(deleteResponse.body.deletedAt).toBeTruthy()
        softDeletedSlug = deleteResponse.body.slug
    })

    it('hides soft-deleted news from public API', async () => {
        const response = await request(app.getHttpServer()).get(`/api/public/news/${softDeletedSlug}`)

        expect(response.status).toBe(404)
    })

    it('returns clear error for duplicate slug', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/admin/news')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                title: 'Дубликат slug',
                slug: 'materialy-gia-po-razdelam',
                excerpt: 'Попытка создать новость с занятым slug.',
                content: 'Повторный slug должен привести к понятной ошибке.',
                categoryId: activeCategoryId,
                isPublished: true,
            })

        expect(response.status).toBe(400)
        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 400,
                errorMessage: 'SLUG_ALREADY_IN_USE',
            })
        )
    })
})
