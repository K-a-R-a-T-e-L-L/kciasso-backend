import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'

import { closeE2eContext, createE2eContext } from './helpers/e2e-context'

jest.setTimeout(60000)

describe('News media (e2e)', () => {
    let app: INestApplication
    let context: Awaited<ReturnType<typeof createE2eContext>>
    let root: string
    let token: string

    beforeAll(async () => {
        root = await mkdtemp(join(tmpdir(), 'kciasso-news-media-'))
        process.env.NEWS_MEDIA_ROOT = root
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

    afterAll(async () => {
        await closeE2eContext(context)
        await rm(root, { recursive: true, force: true })
        delete process.env.NEWS_MEDIA_ROOT
    })

    it('accepts valid raster signatures and rejects SVG, mismatches, and oversized files', async () => {
        const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
        expect(
            (
                await request(app.getHttpServer())
                    .post('/api/admin/news/media')
                    .set('Authorization', `Bearer ${token}`)
                    .attach('file', png, { filename: 'cover.png', contentType: 'image/png' })
            ).status
        ).toBe(201)
        expect(
            (
                await request(app.getHttpServer())
                    .post('/api/admin/news/media')
                    .set('Authorization', `Bearer ${token}`)
                    .attach('file', Buffer.from('<svg/>'), { filename: 'x.svg', contentType: 'image/svg+xml' })
            ).status
        ).toBe(400)
        expect(
            (
                await request(app.getHttpServer())
                    .post('/api/admin/news/media')
                    .set('Authorization', `Bearer ${token}`)
                    .attach('file', Buffer.from('not-png'), { filename: 'x.png', contentType: 'image/png' })
            ).status
        ).toBe(400)
        expect(
            (
                await request(app.getHttpServer())
                    .post('/api/admin/news/media')
                    .set('Authorization', `Bearer ${token}`)
                    .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), {
                        filename: 'x.jpg',
                        contentType: 'image/jpeg',
                    })
            ).status
        ).toBe(400)
    })

    it('uses unique owned keys and deletes only after the last referencing news record releases it', async () => {
        const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
        const firstUpload = await request(app.getHttpServer())
            .post('/api/admin/news/media')
            .set('Authorization', `Bearer ${token}`)
            .attach('file', png, { filename: 'one.png', contentType: 'image/png' })
        const secondUpload = await request(app.getHttpServer())
            .post('/api/admin/news/media')
            .set('Authorization', `Bearer ${token}`)
            .attach('file', png, { filename: 'two.png', contentType: 'image/png' })
        expect(firstUpload.body.key).not.toBe(secondUpload.body.key)
        expect((await request(app.getHttpServer()).get(firstUpload.body.url)).status).toBe(200)

        const create = (slug: string) =>
            request(app.getHttpServer())
                .post('/api/admin/news')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    slug,
                    title: `News ${slug}`,
                    excerpt: 'Valid excerpt',
                    content: 'Valid content',
                    coverImageUrl: firstUpload.body.url,
                })
        const first = await create('owned-media-one')
        const second = await create('owned-media-two')
        await request(app.getHttpServer())
            .patch(`/api/admin/news/${first.body.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ coverImageUrl: 'https://example.com/external.png' })
        expect((await request(app.getHttpServer()).get(firstUpload.body.url)).status).toBe(200)
        await request(app.getHttpServer())
            .delete(`/api/admin/news/${second.body.id}`)
            .set('Authorization', `Bearer ${token}`)
        expect((await request(app.getHttpServer()).get(firstUpload.body.url)).status).toBe(404)
    })

    it('clears owned and external covers only through an explicit successful update', async () => {
        const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
        const upload = await request(app.getHttpServer())
            .post('/api/admin/news/media')
            .set('Authorization', `Bearer ${token}`)
            .attach('file', png, { filename: 'lifecycle.png', contentType: 'image/png' })
        const created = await request(app.getHttpServer())
            .post('/api/admin/news')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Lifecycle owned', excerpt: 'Excerpt', content: 'Content', coverImageUrl: upload.body.url })
        expect(created.status).toBe(201)

        const cleared = await request(app.getHttpServer())
            .patch(`/api/admin/news/${created.body.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ coverImageUrl: null })
        expect(cleared.status).toBe(200)
        expect(cleared.body.coverImageUrl).toBeNull()
        expect((await request(app.getHttpServer()).get(upload.body.url)).status).toBe(404)

        const external = await request(app.getHttpServer())
            .patch(`/api/admin/news/${created.body.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ coverImageUrl: 'https://example.com/external.png' })
        expect(external.body.coverImageUrl).toBe('https://example.com/external.png')
        const removedExternal = await request(app.getHttpServer())
            .patch(`/api/admin/news/${created.body.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ coverImageUrl: null })
        expect(removedExternal.body.coverImageUrl).toBeNull()
    })
})
