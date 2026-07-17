import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import * as request from 'supertest'

import { closeE2eContext, createE2eContext } from './helpers/e2e-context'
import { DocumentReconciliationService } from '../src/system/documents/services/document-reconciliation.service'
import { DocumentStorage } from '../src/system/documents/storage/document-storage'

jest.setTimeout(60000)

const pdfV1 = Buffer.from('%PDF-1.7\nshare-v1\n%%EOF')
const pdfV2 = Buffer.from('%PDF-1.7\nshare-v2\n%%EOF')

describe('Document secret share links (e2e)', () => {
    let app: INestApplication
    let context: Awaited<ReturnType<typeof createE2eContext>>
    let prisma: PrismaClient
    let root: string
    let superAdminToken: string
    let permittedAdminToken: string
    let deniedAdminToken: string
    let documentId: number
    let versionOneId: number
    let versionTwoId: number
    const shareLinkIds: number[] = []

    beforeAll(async () => {
        root = await mkdtemp(join(tmpdir(), 'kciasso-share-links-e2e-'))
        process.env.DOCUMENT_STORAGE_ROOT = join(root, 'documents')
        process.env.DOCUMENT_TEMP_ROOT = join(root, 'tmp')
        process.env.DOCUMENT_MAX_FILE_SIZE_MB = '1'
        context = await createE2eContext()
        app = context.app
        prisma = context.prisma
        expect((app.get(DocumentStorage) as DocumentStorage & { root?: string }).root).toBe(join(root, 'documents'))

        const email = process.env.SUPER_ADMIN_EMAIL || 'admin@example.com'
        const password = process.env.SUPER_ADMIN_PASSWORD || 'change_me_12345'
        superAdminToken = (await request(app.getHttpServer()).post('/api/user/authenticate').send({ email, password }))
            .body.token

        const permitted = await request(app.getHttpServer())
            .post('/api/user/admin/users')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                name: 'Share Links Permitted',
                email: 'share-links-permitted@example.com',
                password,
                role: 'ADMIN',
                isActive: true,
                canManageNews: false,
                canManageSiteSettings: false,
                documentsAccessMode: 'SELECTED_GROUPS',
                documentGroups: ['GIA_9'],
            })
        permittedAdminToken = (
            await request(app.getHttpServer())
                .post('/api/user/authenticate')
                .send({ email: permitted.body.email, password })
        ).body.token

        const denied = await request(app.getHttpServer())
            .post('/api/user/admin/users')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                name: 'Share Links Denied',
                email: 'share-links-denied@example.com',
                password,
                role: 'ADMIN',
                isActive: true,
                canManageNews: true,
                canManageSiteSettings: false,
                documentsAccessMode: 'NONE',
                documentGroups: [],
            })
        deniedAdminToken = (
            await request(app.getHttpServer())
                .post('/api/user/authenticate')
                .send({ email: denied.body.email, password })
        ).body.token

        const created = await request(app.getHttpServer())
            .post('/api/admin/documents')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .field('placementKeys', 'gia-9.normative-documents')
            .field('title', 'Share link fixture')
            .attach('file', pdfV1, { filename: 'share-v1.pdf', contentType: 'application/pdf' })
        expect(created.status).toBe(201)
        documentId = created.body.id
        versionOneId = created.body.currentVersion.id

        const versionTwo = await request(app.getHttpServer())
            .post(`/api/admin/documents/${documentId}/versions`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .attach('file', pdfV2, { filename: 'share-v2.pdf', contentType: 'application/pdf' })
        expect(versionTwo.status).toBe(201)
        versionTwoId = versionTwo.body.currentVersion.id
    })

    afterAll(async () => {
        if (prisma) {
            await prisma.documentShareLink.deleteMany({ where: { document_version: { document_id: documentId } } })
            await prisma.document
                .update({ where: { id: documentId }, data: { current_version_id: null } })
                .catch(() => undefined)
            await prisma.documentVersion.deleteMany({ where: { document_id: documentId } })
            await prisma.document.deleteMany({ where: { id: documentId } })
        }
        await closeE2eContext(context)
        await rm(root, { recursive: true, force: true })
        delete process.env.DOCUMENT_STORAGE_ROOT
        delete process.env.DOCUMENT_TEMP_ROOT
        delete process.env.DOCUMENT_MAX_FILE_SIZE_MB
    })

    it('generates high-entropy token and stores only hash/prefix', async () => {
        const response = await request(app.getHttpServer())
            .post(`/api/admin/document-versions/${versionOneId}/share-links`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({})

        expect(response.status).toBe(201)
        const body = response.body
        shareLinkIds.push(body.id)
        expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
        expect(body.token).not.toMatch(/[+/=]/)
        expect(body.tokenPrefix).toBe(body.token.slice(0, 8))
        expect(body.sharePath).toBe(`/share/document#${body.token}`)
        expect(JSON.stringify(body)).not.toMatch(/tokenHash|storageKey|storageRoot|tempRoot|[A-Z]:\\/i)

        const stored = await prisma.documentShareLink.findUnique({ where: { id: body.id } })
        expect(stored?.token_hash).toBe(createHash('sha256').update(body.token).digest('hex'))
        expect(stored?.token_hash).toMatch(/^[a-f0-9]{64}$/)
        expect(stored?.token_prefix).toBe(body.token.slice(0, 8))
    })

    it('lists without raw token and resolves exact version bytes without auth', async () => {
        const created = await request(app.getHttpServer())
            .post(`/api/admin/document-versions/${versionOneId}/share-links`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({})
        shareLinkIds.push(created.body.id)

        const listed = await request(app.getHttpServer())
            .get(`/api/admin/document-versions/${versionOneId}/share-links`)
            .set('Authorization', `Bearer ${superAdminToken}`)
        expect(listed.status).toBe(200)
        expect(JSON.stringify(listed.body)).not.toMatch(/tokenHash|storageKey|storageRoot|tempRoot|[A-Z]:\\/i)

        const resolved = await request(app.getHttpServer())
            .post('/api/public/document-share-links/resolve')
            .send({ token: created.body.token })
        expect(resolved.status).toBe(200)
        expect(resolved.body).toEqual(pdfV1)
        expect(resolved.headers['cache-control']).toBe('private, no-store')
        expect(resolved.headers['referrer-policy']).toBe('no-referrer')
        expect(resolved.headers['x-robots-tag']).toBe('noindex, nofollow, noarchive')
        expect(resolved.headers['x-content-type-options']).toBe('nosniff')
        expect(resolved.headers['content-type']).toContain('application/pdf')
        expect(resolved.headers['content-disposition']).toContain('inline')

        const stored = await prisma.documentShareLink.findUniqueOrThrow({ where: { id: created.body.id } })
        expect(stored.access_count).toBe(1)
        expect(stored.last_access_at).not.toBeNull()
    })

    it('allows an ordinary admin with documents permission to manage links', async () => {
        const created = await request(app.getHttpServer())
            .post(`/api/admin/document-versions/${versionOneId}/share-links`)
            .set('Authorization', `Bearer ${permittedAdminToken}`)
            .send({})
        expect(created.status).toBe(201)
        shareLinkIds.push(created.body.id)

        const listed = await request(app.getHttpServer())
            .get(`/api/admin/document-versions/${versionOneId}/share-links`)
            .set('Authorization', `Bearer ${permittedAdminToken}`)
        expect(listed.status).toBe(200)
        expect(listed.body.some((link: { id: number }) => link.id === created.body.id)).toBe(true)
        expect(JSON.stringify(listed.body)).not.toContain(created.body.token)

        const resolved = await request(app.getHttpServer())
            .post('/api/public/document-share-links/resolve')
            .send({ token: created.body.token })
        expect(resolved.status).toBe(200)

        const revoked = await request(app.getHttpServer())
            .post(`/api/admin/document-share-links/${created.body.id}/revoke`)
            .set('Authorization', `Bearer ${permittedAdminToken}`)
        expect(revoked.status).toBe(200)

        const unavailable = await request(app.getHttpServer())
            .post('/api/public/document-share-links/resolve')
            .send({ token: created.body.token })
        expect(unavailable.status).toBe(404)
    })

    it('stays pinned to version one when current version changes', async () => {
        const created = await request(app.getHttpServer())
            .post(`/api/admin/document-versions/${versionOneId}/share-links`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({})
        shareLinkIds.push(created.body.id)

        const switched = await request(app.getHttpServer())
            .post(`/api/admin/documents/${documentId}/versions/${versionOneId}/current`)
            .set('Authorization', `Bearer ${superAdminToken}`)
        expect(switched.status).toBe(200)

        const resolved = await request(app.getHttpServer())
            .post('/api/public/document-share-links/resolve')
            .send({ token: created.body.token })
        expect(resolved.body).toEqual(pdfV1)

        const second = await request(app.getHttpServer())
            .post(`/api/admin/document-versions/${versionTwoId}/share-links`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({})
        expect(second.status).toBe(201)
        shareLinkIds.push(second.body.id)
        const secondResolved = await request(app.getHttpServer())
            .post('/api/public/document-share-links/resolve')
            .send({ token: second.body.token })
        expect(secondResolved.body).toEqual(pdfV2)
    })

    it('supports future expiry and idempotent revoke without deleting the file', async () => {
        const created = await request(app.getHttpServer())
            .post(`/api/admin/document-versions/${versionTwoId}/share-links`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ expiresAt: new Date(Date.now() + 60_000).toISOString() })
        expect(created.status).toBe(201)
        shareLinkIds.push(created.body.id)

        const revoked = await request(app.getHttpServer())
            .post(`/api/admin/document-share-links/${created.body.id}/revoke`)
            .set('Authorization', `Bearer ${superAdminToken}`)
        expect(revoked.status).toBe(200)
        expect(revoked.body.revokedAt).toBeTruthy()

        const revokedAgain = await request(app.getHttpServer())
            .post(`/api/admin/document-share-links/${created.body.id}/revoke`)
            .set('Authorization', `Bearer ${superAdminToken}`)
        expect(revokedAgain.status).toBe(200)

        const unavailable = await request(app.getHttpServer())
            .post('/api/public/document-share-links/resolve')
            .send({ token: created.body.token })
        expect(unavailable.status).toBe(404)
        expect(unavailable.body.errorMessage).toBe('DOCUMENT_SHARE_LINK_UNAVAILABLE')
        expect(await prisma.documentVersion.count({ where: { id: versionTwoId } })).toBe(1)
    })

    it('reports share-link reconciliation counts from the isolated database and storage', async () => {
        const active = await request(app.getHttpServer())
            .post(`/api/admin/document-versions/${versionOneId}/share-links`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({})
        const expired = await request(app.getHttpServer())
            .post(`/api/admin/document-versions/${versionOneId}/share-links`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ expiresAt: new Date(Date.now() + 60_000).toISOString() })
        const revoked = await request(app.getHttpServer())
            .post(`/api/admin/document-versions/${versionOneId}/share-links`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({})
        const missing = await request(app.getHttpServer())
            .post(`/api/admin/document-versions/${versionOneId}/share-links`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({})
        expect([active, expired, revoked, missing].every(response => response.status === 201)).toBe(true)
        shareLinkIds.push(active.body.id, expired.body.id, revoked.body.id, missing.body.id)

        await prisma.documentShareLink.update({
            where: { id: expired.body.id },
            data: { expires_at: new Date(Date.now() - 1_000) },
        })
        await request(app.getHttpServer())
            .post(`/api/admin/document-share-links/${revoked.body.id}/revoke`)
            .set('Authorization', `Bearer ${superAdminToken}`)
        const versionRow = await prisma.documentVersion.findUniqueOrThrow({ where: { id: versionOneId } })
        await app.get(DocumentStorage).delete(versionRow.storage_key)

        const summary = await app.get(DocumentReconciliationService).inspect()
        const links = await prisma.documentShareLink.findMany({
            where: { document_version: { document_id: documentId } },
            select: {
                revoked_at: true,
                expires_at: true,
                document_version: {
                    select: {
                        storage_key: true,
                        document: { select: { deleted_at: true, status: true } },
                    },
                },
            },
        })
        const now = new Date()
        let expectedMissing = 0
        let expectedActive = 0
        let expectedExpired = 0
        let expectedRevoked = 0
        for (const link of links) {
            if (!(await app.get(DocumentStorage).exists(link.document_version.storage_key))) expectedMissing += 1
            if (link.revoked_at) expectedRevoked += 1
            else if (link.expires_at && link.expires_at <= now) expectedExpired += 1
            else if (
                !link.document_version.document.deleted_at &&
                link.document_version.document.status !== 'ARCHIVED'
            ) {
                expectedActive += 1
            }
        }
        expect(summary).toEqual(
            expect.objectContaining({
                shareLinksMissingPhysicalFiles: expectedMissing,
                activeShareLinks: expectedActive,
                expiredShareLinks: expectedExpired,
                revokedShareLinks: expectedRevoked,
                dryRun: true,
            })
        )

        await writeFile(join(root, 'documents', versionRow.storage_key), pdfV1)
    })

    it('rejects archived/expired links and protects admin endpoints by documents permission', async () => {
        const expired = await request(app.getHttpServer())
            .post(`/api/admin/document-versions/${versionTwoId}/share-links`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ expiresAt: new Date(Date.now() - 1000).toISOString() })
        expect(expired.status).toBe(400)
        expect(expired.body.errorMessage).toBe('DOCUMENT_SHARE_LINK_EXPIRY_INVALID')

        const unknown = await request(app.getHttpServer())
            .post('/api/public/document-share-links/resolve')
            .send({ token: 'a'.repeat(43) })
        expect(unknown.status).toBe(404)
        expect(unknown.body.errorMessage).toBe('DOCUMENT_SHARE_LINK_UNAVAILABLE')

        const missingFileLink = await request(app.getHttpServer())
            .post(`/api/admin/document-versions/${versionTwoId}/share-links`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({})
        expect(missingFileLink.status).toBe(201)
        shareLinkIds.push(missingFileLink.body.id)
        const versionRow = await prisma.documentVersion.findUniqueOrThrow({ where: { id: versionTwoId } })
        await app.get(DocumentStorage).delete(versionRow.storage_key)
        expect(await app.get(DocumentStorage).exists(versionRow.storage_key)).toBe(false)
        const missingFile = await request(app.getHttpServer())
            .post('/api/public/document-share-links/resolve')
            .send({ token: missingFileLink.body.token })
        expect(missingFile.status).toBe(404)
        expect(missingFile.body.errorMessage).toBe('DOCUMENT_SHARE_LINK_UNAVAILABLE')

        for (const call of [
            () => request(app.getHttpServer()).get(`/api/admin/document-versions/${versionOneId}/share-links`),
            () =>
                request(app.getHttpServer()).post(`/api/admin/document-versions/${versionOneId}/share-links`).send({}),
        ]) {
            expect((await call().set('Authorization', `Bearer ${deniedAdminToken}`)).status).toBe(403)
        }

        const archived = await request(app.getHttpServer())
            .patch(`/api/admin/documents/${documentId}/status`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ status: 'ARCHIVED' })
        expect(archived.status).toBe(400)

        const rejected = await request(app.getHttpServer())
            .post(`/api/admin/document-versions/${versionOneId}/share-links`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({})
        expect(rejected.status).toBe(201)
    })
})
