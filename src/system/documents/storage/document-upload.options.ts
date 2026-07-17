import { randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'

import { diskStorage } from 'multer'

import { resolveStorageRoot } from './document-storage.config'

export function documentUploadOptions() {
    const tempRoot = resolveStorageRoot(process.env.DOCUMENT_TEMP_ROOT || './storage/tmp')
    const maxSizeMb = Number(process.env.DOCUMENT_MAX_FILE_SIZE_MB || 50)
    mkdirSync(tempRoot, { recursive: true })

    return {
        storage: diskStorage({
            destination: tempRoot,
            filename: (_request, _file, callback) => callback(null, randomBytes(24).toString('hex')),
        }),
        limits: { fileSize: maxSizeMb * 1024 * 1024, files: 1 },
    }
}
