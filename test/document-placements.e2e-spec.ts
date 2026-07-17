import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import * as request from 'supertest'

import { closeE2eContext, createE2eContext } from './helpers/e2e-context'

jest.setTimeout(120000)

describe('Universal document placements (e2e)', () => {
    let app: INestApplication
    let context: Awaited<ReturnType<typeof createE2eContext>>
    let prisma: PrismaClient
    let root: string
    let token: string

    beforeAll(async () => {
        root = await mkdtemp(join(tmpdir(), 'kciasso-placements-e2e-'))
        process.env.DOCUMENT_STORAGE_ROOT = join(root, 'documents')
        process.env.DOCUMENT_TEMP_ROOT = join(root, 'tmp')
        context = await createE2eContext()
        app = context.app
        prisma = context.prisma
        const auth = await request(app.getHttpServer())
            .post('/api/user/authenticate')
            .send({
                email: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
                password: process.env.SUPER_ADMIN_PASSWORD || 'change_me_12345',
            })
        token = auth.body.token
    })

    afterAll(async () => {
        await closeE2eContext(context)
        await rm(root, { recursive: true, force: true })
    })

    it('shares one file across sections, preserves independent order, removes placements, and fully deletes', async () => {
        const created = await request(app.getHttpServer())
            .post('/api/admin/documents')
            .set('Authorization', `Bearer ${token}`)
            .field('placementKeys', JSON.stringify(['gia-9.normative-documents', 'gia-11.normative-documents']))
            .field('title', 'shared-placement')
            .attach('file', Buffer.from('%PDF-1.7\nshared\n%%EOF'), {
                filename: 'shared.pdf',
                contentType: 'application/pdf',
            })
        expect(created.status).toBe(201)
        const id = created.body.id
        expect(created.body.placements).toHaveLength(2)
        const versions = await prisma.documentVersion.findMany({ where: { document_id: id } })
        expect(versions).toHaveLength(1)

        await request(app.getHttpServer())
            .patch(`/api/admin/documents/${id}/status`)
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'PUBLISHED' })
        const gia9 = await request(app.getHttpServer())
            .get('/api/public/documents')
            .query({ sectionKey: 'gia-9.normative-documents' })
        const gia11 = await request(app.getHttpServer())
            .get('/api/public/documents')
            .query({ sectionKey: 'gia-11.normative-documents' })
        expect(gia9.body.map((item: { id: number }) => item.id)).toContain(id)
        expect(gia11.body.map((item: { id: number }) => item.id)).toContain(id)

        const updated = await request(app.getHttpServer())
            .put(`/api/admin/documents/${id}/placements`)
            .set('Authorization', `Bearer ${token}`)
            .send({ placementKeys: ['gia-9.results', 'gia-11.normative-documents'] })
        expect(updated.status).toBe(200)
        expect(updated.body.placements.map((item: { sectionKey: string }) => item.sectionKey).sort()).toEqual([
            'gia-11.normative-documents',
            'gia-9.results',
        ])
        expect(await prisma.documentVersion.count({ where: { document_id: id } })).toBe(1)

        const order = await request(app.getHttpServer())
            .patch('/api/admin/document-placements/reorder')
            .set('Authorization', `Bearer ${token}`)
            .send({ sectionKey: 'gia-11.normative-documents', orderedDocumentIds: [id] })
        expect(order.status).toBe(200)

        const deleted = await request(app.getHttpServer())
            .delete(`/api/admin/documents/${id}`)
            .set('Authorization', `Bearer ${token}`)
        expect(deleted.status).toBe(204)
        expect(await prisma.document.count({ where: { id } })).toBe(0)
        expect(await prisma.documentPlacement.count({ where: { document_id: id } })).toBe(0)
        expect(await prisma.documentVersion.count({ where: { document_id: id } })).toBe(0)
        expect(await readdir(join(root, 'documents', '.quarantine')).catch(() => [])).toHaveLength(0)
    })
})
