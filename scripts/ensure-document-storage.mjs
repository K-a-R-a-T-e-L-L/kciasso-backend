import { constants } from 'node:fs'
import { access, mkdir } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'

function resolveRoot(value) {
    if (!value) throw new Error('Document storage root is not configured')
    return isAbsolute(value) ? resolve(value) : resolve(process.cwd(), value)
}

const roots = [
    resolveRoot(process.env.DOCUMENT_STORAGE_ROOT),
    resolveRoot(process.env.DOCUMENT_TEMP_ROOT),
]

for (const root of roots) {
    await mkdir(root, { recursive: true })
    await access(root, constants.R_OK | constants.W_OK)
}

console.log('Document storage directories are ready')
