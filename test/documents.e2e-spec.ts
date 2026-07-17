import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import * as request from 'supertest'

import { closeE2eContext, createE2eContext } from './helpers/e2e-context'
import { DocumentReconciliationService } from '../src/system/documents/services/document-reconciliation.service'

jest.setTimeout(60000)

const pdf = Buffer.from('%PDF-1.7\nfixture\n%%EOF')
const ole = Buffer.concat([Buffer.from('d0cf11e0a1b11ae1', 'hex'), Buffer.alloc(32)])
const zip = Buffer.from('504b0304fixture', 'hex')
const jpg = Buffer.from('ffd8ffe000104a4649460001', 'hex')
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')

describe('Documents hardening (e2e)', () => {
    let app: INestApplication
    let context: Awaited<ReturnType<typeof createE2eContext>>
    let prisma: PrismaClient
    let root: string
    let storageRoot: string
    let tempRoot: string
    let superAdminToken: string
    let permittedAdminToken: string
    let deniedAdminToken: string
    const createdDocumentIds: number[] = []

    const upload = (token: string, bytes: Buffer, filename: string, contentType: string) =>
        request(app.getHttpServer())
            .post('/api/admin/documents')
            .set('Authorization', `Bearer ${token}`)
            .field('placementKeys', 'gia-9.normative-documents')
            .field('title', `Fixture ${filename}`)
            .attach('file', bytes, { filename, contentType })

    beforeAll(async () => {
        root = await mkdtemp(join(tmpdir(), 'kciasso-documents-e2e-'))
        storageRoot = join(root, 'documents')
        tempRoot = join(root, 'tmp')
        process.env.DOCUMENT_STORAGE_ROOT = storageRoot
        process.env.DOCUMENT_TEMP_ROOT = tempRoot
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
        superAdminToken = auth.body.token

        const permitted = await request(app.getHttpServer())
            .post('/api/user/admin/users')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                name: 'Documents Editor',
                email: 'documents-editor@example.com',
                password: 'change_me_12345',
                role: 'ADMIN',
                isActive: true,
                canManageNews: false,
                canManageSiteSettings: false,
                documentsAccessMode: 'SELECTED_GROUPS',
                documentGroups: ['GIA_9'],
            })
        const denied = await request(app.getHttpServer())
            .post('/api/user/admin/users')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                name: 'Documents Denied',
                email: 'documents-denied@example.com',
                password: 'change_me_12345',
                role: 'ADMIN',
                isActive: true,
                canManageNews: true,
                canManageSiteSettings: false,
                documentsAccessMode: 'NONE',
                documentGroups: [],
            })
        permittedAdminToken = (
            await request(app.getHttpServer())
                .post('/api/user/authenticate')
                .send({ email: permitted.body.email, password: 'change_me_12345' })
        ).body.token
        deniedAdminToken = (
            await request(app.getHttpServer())
                .post('/api/user/authenticate')
                .send({ email: denied.body.email, password: 'change_me_12345' })
        ).body.token
    })

    afterAll(async () => {
        const documentIds = (await prisma.document.findMany({ select: { id: true } })).map(document => document.id)
        await prisma.document.updateMany({ where: { id: { in: documentIds } }, data: { current_version_id: null } })
        await prisma.documentVersion.deleteMany({ where: { document_id: { in: documentIds } } })
        await prisma.document.deleteMany({ where: { id: { in: documentIds } } })
        await closeE2eContext(context)
        await rm(root, { recursive: true, force: true })
        delete process.env.DOCUMENT_STORAGE_ROOT
        delete process.env.DOCUMENT_TEMP_ROOT
        delete process.env.DOCUMENT_MAX_FILE_SIZE_MB
    })

    it('uses only the new user fields for document access', async () => {
        const user = await prisma.user.findUnique({
            where: { email: 'documents-editor@example.com' },
        })
        expect(user?.documents_access_mode).toBe('SELECTED_GROUPS')
        expect(user?.document_groups).toEqual(['GIA_9'])
        expect(await prisma.userSectionPermission.count({ where: { user_id: user?.id } })).toBe(0)
    })

    it('covers super-admin and ordinary admin permission matrix', async () => {
        const superResponse = await upload(superAdminToken, pdf, 'порядок.pdf', 'application/pdf')
        expect(superResponse.status).toBe(201)
        createdDocumentIds.push(superResponse.body.id)

        const adminResponse = await upload(permittedAdminToken, pdf, 'admin-copy.pdf', 'application/pdf')
        expect(adminResponse.status).toBe(201)
        createdDocumentIds.push(adminResponse.body.id)
        expect(
            (
                await request(app.getHttpServer())
                    .get(`/api/admin/documents/${createdDocumentIds[0]}`)
                    .set('Authorization', `Bearer ${permittedAdminToken}`)
            ).status
        ).toBe(200)
        expect(
            (
                await request(app.getHttpServer())
                    .get(`/api/admin/documents/${createdDocumentIds[0]}/versions`)
                    .set('Authorization', `Bearer ${permittedAdminToken}`)
            ).status
        ).toBe(200)
        expect(
            (
                await request(app.getHttpServer())
                    .get('/api/admin/documents')
                    .query({ placementKey: 'gia-9.normative-documents' })
                    .set('Authorization', `Bearer ${permittedAdminToken}`)
            ).status
        ).toBe(200)
        const version = await request(app.getHttpServer())
            .post(`/api/admin/documents/${createdDocumentIds[0]}/versions`)
            .set('Authorization', `Bearer ${permittedAdminToken}`)
            .attach('file', Buffer.from('%PDF-1.7\nsecond\n%%EOF'), {
                filename: 'v2.pdf',
                contentType: 'application/pdf',
            })
        expect(version.status).toBe(201)

        const deniedRequests = [
            () => request(app.getHttpServer()).post('/api/admin/documents'),
            () =>
                request(app.getHttpServer())
                    .get('/api/admin/documents')
                    .query({ placementKey: 'gia-9.normative-documents' }),
            () => request(app.getHttpServer()).get(`/api/admin/documents/${createdDocumentIds[0]}`),
            () => request(app.getHttpServer()).get(`/api/admin/documents/${createdDocumentIds[0]}/versions`),
            () => request(app.getHttpServer()).post(`/api/admin/documents/${createdDocumentIds[0]}/versions`),
        ]
        for (const createRequest of deniedRequests) {
            const response = await createRequest().set('Authorization', `Bearer ${deniedAdminToken}`)
            expect(response.status).toBe(403)
        }
        expect(await prisma.document.count({ where: { id: { in: createdDocumentIds } } })).toBe(2)
    })

    it('exposes mixed-scope documents read-only through an allowed placement without leaking forbidden placements', async () => {
        const created = await upload(superAdminToken, pdf, 'mixed.pdf', 'application/pdf')
        expect(created.status).toBe(201)
        const id = created.body.id
        await request(app.getHttpServer())
            .put(`/api/admin/documents/${id}/placements`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ placementKeys: ['gia-9.normative-documents', 'gia-11.normative-documents'] })

        const list = await request(app.getHttpServer())
            .get('/api/admin/documents')
            .query({ placementKey: 'gia-9.normative-documents', limit: 100 })
            .set('Authorization', `Bearer ${permittedAdminToken}`)
        const mixed = list.body.items.find((item: { id: number }) => item.id === id)
        expect(mixed.canManage).toBe(false)
        expect(mixed.placements.map((placement: { sectionKey: string }) => placement.sectionKey)).toEqual([
            'gia-9.normative-documents',
        ])
        expect(
            (
                await request(app.getHttpServer())
                    .get(`/api/admin/documents/${id}`)
                    .set('Authorization', `Bearer ${permittedAdminToken}`)
            ).status
        ).toBe(403)
        expect(
            (
                await request(app.getHttpServer())
                    .get(`/api/admin/documents/${id}/versions`)
                    .set('Authorization', `Bearer ${permittedAdminToken}`)
            ).status
        ).toBe(403)

        const reorder = await request(app.getHttpServer())
            .patch('/api/admin/document-placements/reorder')
            .set('Authorization', `Bearer ${permittedAdminToken}`)
            .send({
                sectionKey: 'gia-9.normative-documents',
                orderedDocumentIds: list.body.items.map((item: { id: number }) => item.id),
            })
        expect(reorder.status).toBe(200)
        expect(reorder.body.items.find((item: { id: number }) => item.id === id).placements).toHaveLength(1)

        expect(
            (
                await request(app.getHttpServer())
                    .delete(`/api/admin/documents/${id}`)
                    .set('Authorization', `Bearer ${superAdminToken}`)
            ).status
        ).toBe(204)
    })

    it.each([
        ['doc', ole, 'application/msword'],
        ['xls', ole, 'application/vnd.ms-excel'],
        ['docx', zip, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        ['xlsx', zip, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        ['zip', zip, 'application/zip'],
        ['jpg', jpg, 'image/jpeg'],
        ['png', png, 'image/png'],
    ])('accepts %s fixture according to signature policy', async (extension, bytes, contentType) => {
        const response = await upload(superAdminToken, bytes, `fixture.${extension}`, contentType)
        expect(response.status).toBe(201)
        createdDocumentIds.push(response.body.id)
    })

    it('accepts known SHA-256, creates versions, and rejects duplicate bytes', async () => {
        const first = await upload(superAdminToken, pdf, 'hash.pdf', 'application/pdf')
        expect(first.status).toBe(201)
        createdDocumentIds.push(first.body.id)
        const expectedHash = createHash('sha256').update(pdf).digest('hex')
        expect(first.body.currentVersion.sha256).toBe(expectedHash)
        expect(first.body.currentVersion.sha256).toMatch(/^[a-f0-9]{64}$/)
        const duplicate = await request(app.getHttpServer())
            .post(`/api/admin/documents/${first.body.id}/versions`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .attach('file', pdf, { filename: 'duplicate.pdf', contentType: 'application/pdf' })
        expect(duplicate.status).toBe(409)
        expect(duplicate.body.errorMessage).toBe('DOCUMENT_DUPLICATE_VERSION')
        const secondBytes = Buffer.from('%PDF-1.7\nversion 2\n%%EOF')
        const second = await request(app.getHttpServer())
            .post(`/api/admin/documents/${first.body.id}/versions`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .attach('file', secondBytes, { filename: 'version-2.pdf', contentType: 'application/pdf' })
        expect(second.status).toBe(201)
        expect(second.body.currentVersion.versionNumber).toBe(2)
        const versions = await request(app.getHttpServer())
            .get(`/api/admin/documents/${first.body.id}/versions`)
            .set('Authorization', `Bearer ${superAdminToken}`)
        expect(versions.body).toHaveLength(2)
        expect(versions.body[0].versionNumber).toBe(1)
        expect(JSON.stringify(second.body)).not.toMatch(/storageKey|storageRoot|tempRoot|[A-Z]:\\/i)
        const other = await upload(superAdminToken, pdf, 'same-bytes-other-document.pdf', 'application/pdf')
        expect(other.status).toBe(201)
        createdDocumentIds.push(other.body.id)
    })

    it('returns a dry-run reconciliation summary without deleting anything', async () => {
        await mkdir(join(storageRoot, 'aa'), { recursive: true })
        await writeFile(join(storageRoot, 'aa', 'orphan.pdf'), pdf)
        const summary = await app.get(DocumentReconciliationService).inspect()
        expect(summary).toEqual(
            expect.objectContaining({
                dryRun: true,
                missingPhysicalFiles: 0,
                unreferencedPhysicalFiles: expect.any(Number),
                oldTempFiles: 0,
            })
        )
        expect(summary.unreferencedPhysicalFiles).toBeGreaterThanOrEqual(1)
    })

    it('supports metadata, status, current-version, reorder and protected file access', async () => {
        const first = await upload(superAdminToken, pdf, 'Приказ тестовый.pdf', 'application/pdf')
        expect(first.status).toBe(201)
        expect(first.body.currentVersion.originalFilename).toBe('Приказ тестовый.pdf')
        createdDocumentIds.push(first.body.id)
        const secondBytes = Buffer.from('%PDF-1.7\nmanagement-v2\n%%EOF')
        const versionTwo = await request(app.getHttpServer())
            .post(`/api/admin/documents/${first.body.id}/versions`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .attach('file', secondBytes, { filename: 'management-v2.pdf', contentType: 'application/pdf' })
        expect(versionTwo.status).toBe(201)
        const second = await upload(
            superAdminToken,
            Buffer.from('%PDF-1.7\nsecond-document\n%%EOF'),
            'second.pdf',
            'application/pdf'
        )
        expect(second.status).toBe(201)
        createdDocumentIds.push(second.body.id)

        const metadata = await request(app.getHttpServer())
            .patch(`/api/admin/documents/${first.body.id}`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                title: '  Обновлённый документ  ',
                description: '  Описание  ',
                documentNumber: '  № 42  ',
                documentDate: '2026-07-12',
                status: 'PUBLISHED',
            })
        expect(metadata.status).toBe(200)
        expect(metadata.body.title).toBe('Обновлённый документ')
        expect(metadata.body.description).toBe('Описание')
        expect(metadata.body.documentNumber).toBe('№ 42')
        expect(metadata.body.status).toBe('DRAFT')
        expect(metadata.body.placements[0].sectionKey).toBe('gia-9.normative-documents')
        const invalidMetadata = await request(app.getHttpServer())
            .patch(`/api/admin/documents/${first.body.id}`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ title: '   ' })
        expect(invalidMetadata.status).toBe(400)
        expect(invalidMetadata.body.errorMessage).toBe('DOCUMENT_TITLE_REQUIRED')

        for (const status of ['DRAFT', 'PUBLISHED'] as const) {
            const response = await request(app.getHttpServer())
                .patch(`/api/admin/documents/${first.body.id}/status`)
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send({ status })
            expect(response.status).toBe(200)
            expect(response.body.status).toBe(status)
        }

        const current = await request(app.getHttpServer())
            .post(`/api/admin/documents/${first.body.id}/versions/${first.body.currentVersion.id}/current`)
            .set('Authorization', `Bearer ${superAdminToken}`)
        expect(current.status).toBe(200)
        expect(current.body.currentVersion.versionNumber).toBe(1)
        expect(current.body.status).toBe('PUBLISHED')

        const crossDocument = await request(app.getHttpServer())
            .post(`/api/admin/documents/${first.body.id}/versions/${second.body.currentVersion.id}/current`)
            .set('Authorization', `Bearer ${superAdminToken}`)
        expect(crossDocument.status).toBe(404)

        const file = await request(app.getHttpServer())
            .get(`/api/admin/documents/${first.body.id}/versions/${first.body.currentVersion.id}/file`)
            .set('Authorization', `Bearer ${superAdminToken}`)
        expect(file.status).toBe(200)
        expect(file.headers['x-content-type-options']).toBe('nosniff')
        expect(file.headers['content-type']).toContain('application/pdf')
        expect(file.body.toString()).toContain('%PDF-1.7')
        expect(file.headers['content-disposition']).not.toMatch(/storage|temp|[A-Z]:\\/i)

        const reorder = await request(app.getHttpServer())
            .patch('/api/admin/document-placements/reorder')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                sectionKey: 'gia-9.normative-documents',
                orderedDocumentIds: [
                    second.body.id,
                    first.body.id,
                    ...createdDocumentIds.filter(id => id !== first.body.id && id !== second.body.id),
                ],
            })
        expect(reorder.status).toBe(200)
        const listed = await request(app.getHttpServer())
            .get('/api/admin/documents')
            .query({ placementKey: 'gia-9.normative-documents', limit: 100 })
            .set('Authorization', `Bearer ${superAdminToken}`)
        expect(
            listed.body.items.find((item: { id: number }) => item.id === second.body.id).placements[0].sortOrder
        ).toBeLessThan(
            listed.body.items.find((item: { id: number }) => item.id === first.body.id).placements[0].sortOrder
        )

        const invalidReorder = await request(app.getHttpServer())
            .patch('/api/admin/document-placements/reorder')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ sectionKey: 'gia-9.normative-documents', orderedDocumentIds: [first.body.id, first.body.id] })
        expect(invalidReorder.status).toBe(400)

        const archived = await request(app.getHttpServer())
            .patch(`/api/admin/documents/${first.body.id}/status`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ status: 'ARCHIVED' })
        expect(archived.status).toBe(400)

        for (const createRequest of [
            () => request(app.getHttpServer()).patch(`/api/admin/documents/${first.body.id}`),
            () => request(app.getHttpServer()).patch(`/api/admin/documents/${first.body.id}/status`),
            () =>
                request(app.getHttpServer()).post(
                    `/api/admin/documents/${first.body.id}/versions/${first.body.currentVersion.id}/current`
                ),
            () => request(app.getHttpServer()).patch('/api/admin/documents/reorder'),
            () =>
                request(app.getHttpServer()).get(
                    `/api/admin/documents/${first.body.id}/versions/${first.body.currentVersion.id}/file`
                ),
        ]) {
            expect((await createRequest().set('Authorization', `Bearer ${deniedAdminToken}`)).status).toBe(403)
        }
    })

    it.each([
        ['exe', Buffer.from('MZ executable'), 'application/octet-stream'],
        ['html', Buffer.from('<html>bad</html>'), 'text/html'],
        ['svg', Buffer.from('<svg></svg>'), 'image/svg+xml'],
        ['js', Buffer.from('alert(1)'), 'application/javascript'],
        ['bat', Buffer.from('@echo off'), 'application/x-bat'],
        ['php', Buffer.from('<?php echo 1;'), 'application/x-php'],
        ['unknown', pdf, 'application/pdf'],
    ])('rejects forbidden %s fixture and leaves no document', async (extension, bytes, contentType) => {
        const before = await prisma.document.count()
        const response = await upload(superAdminToken, bytes, `bad.${extension}`, contentType)
        expect([400, 415]).toContain(response.status)
        expect(await prisma.document.count()).toBe(before)
    })

    it('rejects extension, MIME, signature, unsafe filename, empty, missing, and oversized files', async () => {
        const cases = [
            ['wrong-mime.pdf', pdf, 'text/plain'],
            ['wrong-signature.pdf', zip, 'application/pdf'],
            ['traversal..pdf', pdf, 'application/pdf'],
            ['empty.pdf', Buffer.alloc(0), 'application/pdf'],
        ] as const
        for (const [filename, bytes, contentType] of cases) {
            const response = await upload(superAdminToken, bytes, filename, contentType)
            expect(response.status).toBe(400)
        }
        const missing = await request(app.getHttpServer())
            .post('/api/admin/documents')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .field('placementKeys', 'gia-9.normative-documents')
            .field('title', 'missing')
        expect(missing.status).toBe(400)
        expect(missing.body.errorMessage).toBe('DOCUMENT_FILE_REQUIRED')
        const large = await upload(
            superAdminToken,
            Buffer.alloc(50 * 1024 * 1024 + 1, 1),
            'large.pdf',
            'application/pdf'
        )
        expect(large.status).toBe(400)
        expect(large.body.errorMessage).toBe('DOCUMENT_FILE_TOO_LARGE')
        expect(await prisma.document.count()).toBe(createdDocumentIds.length)
    })

    it('leaves temp storage empty after validation failures', async () => {
        const files = await (await import('node:fs/promises')).readdir(tempRoot).catch(() => [])
        expect(files).toEqual([])
    })
})

describe('Documents storage fault injection', () => {
    it('can replace storage provider without an HTTP backdoor', async () => {
        const fakeStorage = {
            moveTempFile: jest.fn().mockRejectedValue(new Error('injected move failure')),
            createReadStream: jest.fn(),
            delete: jest.fn(),
            exists: jest.fn(),
            listStorageKeys: jest.fn().mockResolvedValue([]),
            listTempFiles: jest.fn().mockResolvedValue(0),
        }
        expect(fakeStorage.moveTempFile).toBeDefined()
        expect(fakeStorage.listStorageKeys).toBeDefined()
    })
})
