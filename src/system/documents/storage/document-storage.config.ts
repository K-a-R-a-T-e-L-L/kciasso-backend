import { constants } from 'node:fs'
import { access, mkdir } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'

export function resolveStorageRoot(value: string): string {
    return isAbsolute(value) ? resolve(value) : resolve(process.cwd(), value)
}

export async function ensureDocumentStorageDirectories(storageRoot: string, tempRoot: string): Promise<void> {
    const resolvedStorageRoot = resolveStorageRoot(storageRoot)
    const resolvedTempRoot = resolveStorageRoot(tempRoot)

    await mkdir(resolvedStorageRoot, { recursive: true })
    await mkdir(resolvedTempRoot, { recursive: true })
    await access(resolvedStorageRoot, constants.R_OK | constants.W_OK)
    await access(resolvedTempRoot, constants.R_OK | constants.W_OK)
}
