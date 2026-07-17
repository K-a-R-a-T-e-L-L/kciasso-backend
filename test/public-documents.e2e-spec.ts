import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { INestApplication } from '@nestjs/common'
import { DocumentStatus, PrismaClient } from '@prisma/client'
import * as request from 'supertest'

import { closeE2eContext, createE2eContext } from './helpers/e2e-context'
import { DocumentStorage } from '../src/system/documents/storage/document-storage'

jest.setTimeout(120000)

const sectionKey = 'gia-9.normative-documents'
const fixedDocumentSectionKeys = [
    'gia.results',
    'gia.ege-appeals',
    'quality.rsoko',
    'quality.rsoko.regionalnye-kontrolnye-raboty.demo',
    'quality.vpr.results',
    'regionalnyy-proekt',
    'regionalnyy-proekt.ege',
    'about.ob-uchrezhdenii',
]
const pdfV1 = Buffer.from('%PDF-1.7\npublic-v1\n%%EOF')
const pdfV2 = Buffer.from('%PDF-1.7\npublic-v2\n%%EOF')
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
const zip = Buffer.from('504b030466ixture', 'hex')

describe('Public published documents (e2e)', () => {
    let app: INestApplication
    let context: Awaited<ReturnType<typeof createE2eContext>>
    let prisma: PrismaClient
    let root: string
    let superAdminToken: string

    const createDocument = async (title: string, bytes: Buffer, filename: string, contentType: string) => {
        const response = await request(app.getHttpServer())
            .post('/api/admin/documents')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .field('placementKeys', sectionKey)
            .field('title', title)
            .field('description', `${title} description`)
            .field('documentNumber', `${title}-number`)
            .field('documentDate', '2026-07-12')
            .attach('file', bytes, { filename, contentType })
        expect(response.status).toBe(201)
        return response.body as { id: number; currentVersion: { id: number; versionNumber: number } }
    }

    const getBinary = (path: string) =>
        request(app.getHttpServer())
            .get(path)
            .buffer(true)
            .parse((response, callback) => {
                const chunks: Buffer[] = []
                response.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
                response.on('end', () => callback(null, Buffer.concat(chunks)))
            })

    const setStatus = async (id: number, status: DocumentStatus) => {
        const response = await request(app.getHttpServer())
            .patch(`/api/admin/documents/${id}/status`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ status })
        expect(response.status).toBe(200)
    }

    beforeAll(async () => {
        root = await mkdtemp(join(tmpdir(), 'kciasso-public-documents-e2e-'))
        process.env.DOCUMENT_STORAGE_ROOT = join(root, 'documents')
        process.env.DOCUMENT_TEMP_ROOT = join(root, 'tmp')
        process.env.DOCUMENT_MAX_FILE_SIZE_MB = '1'
        context = await createE2eContext()
        app = context.app
        prisma = context.prisma

        const auth = await request(app.getHttpServer())
            .post('/api/user/authenticate')
            .send({
                email: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
                password: process.env.SUPER_ADMIN_PASSWORD || 'change_me_12345',
            })
        expect(auth.status).toBe(201)
        superAdminToken = auth.body.token
    })

    afterAll(async () => {
        if (prisma) {
            const ids = (await prisma.document.findMany({ select: { id: true } })).map(document => document.id)
            await prisma.documentShareLink.deleteMany({ where: { document_version: { document_id: { in: ids } } } })
            await prisma.document.updateMany({ where: { id: { in: ids } }, data: { current_version_id: null } })
            await prisma.documentVersion.deleteMany({ where: { document_id: { in: ids } } })
            await prisma.document.deleteMany({ where: { id: { in: ids } } })
        }
        await closeE2eContext(context)
        await rm(root, { recursive: true, force: true })
        delete process.env.DOCUMENT_STORAGE_ROOT
        delete process.env.DOCUMENT_TEMP_ROOT
        delete process.env.DOCUMENT_MAX_FILE_SIZE_MB
    })

    it('returns an anonymous safe list with only published documents and deterministic order', async () => {
        const empty = await request(app.getHttpServer()).get('/api/public/documents').query({ sectionKey })
        expect(empty.status).toBe(200)
        expect(empty.body).toEqual([])

        const draft = await createDocument('public-status-draft', pdfV1, 'draft.pdf', 'application/pdf')
        const published = await createDocument('public-status-published', pdfV1, 'published.pdf', 'application/pdf')
        await setStatus(published.id, DocumentStatus.PUBLISHED)

        const reordered = await request(app.getHttpServer())
            .patch('/api/admin/document-placements/reorder')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ sectionKey, orderedDocumentIds: [published.id, draft.id] })
        expect(reordered.status).toBe(200)

        const first = await request(app.getHttpServer()).get('/api/public/documents').query({ sectionKey })
        const second = await request(app.getHttpServer()).get('/api/public/documents').query({ sectionKey })
        expect(first.status).toBe(200)
        expect(second.status).toBe(200)
        expect(first.body.map((item: { id: number }) => item.id)).toEqual([published.id])
        expect(first.body).toEqual(second.body)
        expect(first.body[0]).toEqual(
            expect.objectContaining({
                id: published.id,
                title: 'public-status-published',
                description: 'public-status-published description',
                documentNumber: 'public-status-published-number',
                currentVersion: expect.objectContaining({ extension: 'pdf' }),
            })
        )
        expect(Object.keys(first.body[0]).sort()).toEqual(
            ['currentVersion', 'description', 'documentDate', 'documentNumber', 'id', 'title', 'updatedAt'].sort()
        )
        expect(Object.keys(first.body[0].currentVersion).sort()).toEqual(
            ['extension', 'mimeType', 'originalFilename', 'sizeBytes'].sort()
        )
        expect(draft.id).not.toBe(published.id)
    })

    it('returns empty list for an empty valid section and rejects unknown section safely', async () => {
        const unknown = await request(app.getHttpServer())
            .get('/api/public/documents')
            .query({ sectionKey: 'arbitrary-free-text' })
        expect(unknown.status).toBe(400)
        expect(JSON.stringify(unknown.body)).not.toMatch(/storage|prisma|stack|[A-Z]:\\/i)

        const missing = await request(app.getHttpServer()).get('/api/public/documents')
        expect(missing.status).toBe(400)
    })

    it('accepts fixed placement keys from every new public document group', async () => {
        for (const key of fixedDocumentSectionKeys) {
            const response = await request(app.getHttpServer()).get('/api/public/documents').query({ sectionKey: key })
            expect(response.status).toBe(200)
            expect(response.body).toEqual([])
        }
    })

    it('serves the current version, while secret links remain pinned to v1', async () => {
        const document = await createDocument('public-current-switch', pdfV1, 'current-v1.pdf', 'application/pdf')
        await setStatus(document.id, DocumentStatus.PUBLISHED)
        const share = await request(app.getHttpServer())
            .post(`/api/admin/document-versions/${document.currentVersion.id}/share-links`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({})
        expect(share.status).toBe(201)

        const versionTwo = await request(app.getHttpServer())
            .post(`/api/admin/documents/${document.id}/versions`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .attach('file', pdfV2, { filename: 'current-v2.pdf', contentType: 'application/pdf' })
        expect(versionTwo.status).toBe(201)

        const publicFile = await getBinary(`/api/public/documents/${document.id}/file`)
        expect(publicFile.status).toBe(200)
        expect(publicFile.body).toEqual(pdfV2)
        expect(publicFile.headers['content-disposition']).toContain('inline')
        expect(publicFile.headers['x-content-type-options']).toBe('nosniff')
        expect(publicFile.headers['referrer-policy']).toBe('no-referrer')
        expect(publicFile.headers['x-robots-tag']).toBe('noindex')
        expect(publicFile.headers['cache-control']).toBe('public, max-age=0, must-revalidate')

        const listed = await request(app.getHttpServer()).get('/api/public/documents').query({ sectionKey })
        expect(listed.body.find((item: { id: number }) => item.id === document.id).currentVersion).toEqual(
            expect.objectContaining({ extension: 'pdf', originalFilename: 'current-v2.pdf' })
        )
        const secretFile = await request(app.getHttpServer())
            .post('/api/public/document-share-links/resolve')
            .send({ token: share.body.token })
        expect(secretFile.status).toBe(200)
        expect(secretFile.body).toEqual(pdfV1)
    })

    it.each([
        ['png', png, 'image/png', 'inline'],
        ['zip', zip, 'application/zip', 'attachment'],
    ])('uses the expected binary policy for %s', async (extension, bytes, contentType, disposition) => {
        const document = await createDocument(`public-${extension}`, bytes, `public.${extension}`, contentType)
        await setStatus(document.id, DocumentStatus.PUBLISHED)
        const response = await getBinary(`/api/public/documents/${document.id}/file`)
        expect(response.status).toBe(200)
        expect(response.body).toEqual(bytes)
        expect(response.headers['content-type']).toContain(contentType)
        expect(response.headers['content-disposition']).toContain(disposition)
    })

    it('hides unavailable documents consistently and leaves valid rows visible', async () => {
        const valid = await createDocument('public-valid-after-missing', pdfV1, 'valid.pdf', 'application/pdf')
        const missing = await createDocument('public-missing-file', pdfV1, 'missing.pdf', 'application/pdf')
        await setStatus(valid.id, DocumentStatus.PUBLISHED)
        await setStatus(missing.id, DocumentStatus.PUBLISHED)
        const missingVersion = await prisma.document.findUniqueOrThrow({
            where: { id: missing.id },
            include: { current_version: true },
        })
        await app.get(DocumentStorage).delete(missingVersion.current_version!.storage_key)

        const list = await request(app.getHttpServer()).get('/api/public/documents').query({ sectionKey })
        expect(list.status).toBe(200)
        expect(list.body.map((item: { id: number }) => item.id)).toContain(valid.id)
        expect(list.body.map((item: { id: number }) => item.id)).not.toContain(missing.id)

        for (const id of [missing.id, 99999999]) {
            const response = await request(app.getHttpServer()).get(`/api/public/documents/${id}/file`)
            expect(response.status).toBe(404)
            expect(response.body.errorMessage).toBe('DOCUMENT_PUBLIC_FILE_UNAVAILABLE')
            expect(JSON.stringify(response.body)).not.toMatch(/storage|prisma|stack|[A-Z]:\\/i)
        }
    })
})
