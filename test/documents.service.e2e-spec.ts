import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ConfigService } from '@nestjs/config'

import { DocumentsService } from '../src/system/documents/services/documents.service'

const config = {
    getOrThrow: (key: string) =>
        ({
            NODE_ENV: 'test',
            PORT: 0,
            FRONTEND_URL: 'http://localhost',
            UPLOADS_DIR: './uploads',
            PUBLIC_UPLOADS_URL: '/uploads',
            DOCUMENT_STORAGE_ROOT: './storage/documents',
            DOCUMENT_TEMP_ROOT: './storage/tmp',
            DOCUMENT_MAX_FILE_SIZE_MB: 1,
        })[key],
} as ConfigService

function storageMock() {
    return {
        moveTempFile: jest.fn(),
        createReadStream: jest.fn(),
        delete: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn(),
        listStorageKeys: jest.fn().mockResolvedValue([]),
        listTempFiles: jest.fn().mockResolvedValue(0),
        quarantine: jest.fn(),
        restore: jest.fn(),
        purgeQuarantine: jest.fn(),
    }
}

describe('DocumentsService failure cleanup', () => {
    let root: string
    const actor = { id: 1, is_super_admin: true } as never

    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), 'kciasso-documents-service-'))
    })

    afterEach(async () => {
        await rm(root, { recursive: true, force: true })
    })

    it('removes temp file when storage move fails before the transaction', async () => {
        const tempPath = join(root, 'upload.pdf')
        await writeFile(tempPath, Buffer.from('%PDF-1.7\nfixture'))
        const storage = storageMock()
        storage.moveTempFile.mockRejectedValue(new Error('injected move failure'))
        const prisma = {} as never
        const service = new DocumentsService(prisma, storage as never, config)

        await expect(
            service.createDocument(
                { placementKeys: ['gia-9.normative-documents'], title: 'Failure' },
                { path: tempPath, originalname: 'failure.pdf', mimetype: 'application/pdf', size: 15 },
                actor
            )
        ).rejects.toMatchObject({ response: { errorMessage: 'DOCUMENT_STORAGE_WRITE_FAILED' } })
        await expect(readFile(tempPath)).rejects.toThrow()
        expect(storage.moveTempFile).toHaveBeenCalledTimes(1)
    })

    it('deletes final storage after a transaction failure', async () => {
        const tempPath = join(root, 'upload.pdf')
        await writeFile(tempPath, Buffer.from('%PDF-1.7\nfixture'))
        const storage = storageMock()
        const prisma = {
            $transaction: jest.fn().mockRejectedValue(new Error('injected transaction failure')),
        }
        const service = new DocumentsService(prisma as never, storage as never, config)

        await expect(
            service.createDocument(
                { placementKeys: ['gia-9.normative-documents'], title: 'Transaction failure' },
                { path: tempPath, originalname: 'transaction.pdf', mimetype: 'application/pdf', size: 15 },
                actor
            )
        ).rejects.toThrow('injected transaction failure')
        expect(storage.delete).toHaveBeenCalledTimes(1)
        expect(storage.moveTempFile).toHaveBeenCalledTimes(1)
    })
})
