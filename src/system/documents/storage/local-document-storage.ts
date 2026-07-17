import { constants, createReadStream } from 'node:fs'
import { access, mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, normalize, relative } from 'node:path'

import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { DocumentStorage } from './document-storage'
import { ensureDocumentStorageDirectories, resolveStorageRoot } from './document-storage.config'
import { getAppConfig } from '../../../config/app.config'

@Injectable()
export class LocalDocumentStorage extends DocumentStorage implements OnModuleInit {
    private readonly root: string
    private readonly tempRoot: string
    private readonly quarantineRoot: string

    constructor(config: ConfigService) {
        super()
        const appConfig = getAppConfig(config)
        this.root = resolveStorageRoot(appConfig.documentStorageRoot)
        this.tempRoot = resolveStorageRoot(appConfig.documentTempRoot)
        this.quarantineRoot = join(this.root, '.quarantine')
    }

    async onModuleInit() {
        await ensureDocumentStorageDirectories(this.root, this.tempRoot)
        await mkdir(this.quarantineRoot, { recursive: true })
    }

    private resolveSafePath(storageKey: string): string {
        if (!storageKey || isAbsolute(storageKey)) {
            throw new Error('Invalid storage key')
        }

        const candidate = normalize(join(this.root, storageKey))
        const relativePath = relative(this.root, candidate)
        if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
            throw new Error('Invalid storage key')
        }

        return candidate
    }

    async moveTempFile(tempPath: string, storageKey: string): Promise<void> {
        const finalPath = this.resolveSafePath(storageKey)
        await mkdir(dirname(finalPath), { recursive: true })
        await rename(tempPath, finalPath)
    }

    createReadStream(storageKey: string) {
        return createReadStream(this.resolveSafePath(storageKey))
    }

    async delete(storageKey: string): Promise<void> {
        await rm(this.resolveSafePath(storageKey), { force: true })
    }

    async exists(storageKey: string): Promise<boolean> {
        try {
            await access(this.resolveSafePath(storageKey), constants.F_OK)
            return true
        } catch {
            return false
        }
    }

    async listStorageKeys(): Promise<string[]> {
        const shards = await readdir(this.root, { withFileTypes: true }).catch(() => [])
        const keys: string[] = []
        for (const shard of shards) {
            if (!shard.isDirectory()) continue
            const files = await readdir(join(this.root, shard.name), { withFileTypes: true }).catch(() => [])
            for (const file of files) {
                if (file.isFile()) keys.push(join(shard.name, file.name).replaceAll('\\', '/'))
            }
        }
        return keys
    }

    async listTempFiles(olderThan: Date): Promise<number> {
        const files = await readdir(this.tempRoot, { withFileTypes: true }).catch(() => [])
        let count = 0
        for (const file of files) {
            if (!file.isFile()) continue
            const metadata = await stat(join(this.tempRoot, file.name)).catch(() => null)
            if (metadata && metadata.mtime < olderThan) count += 1
        }
        return count
    }

    async quarantine(storageKey: string): Promise<string> {
        const source = this.resolveSafePath(storageKey)
        const key = `${Date.now()}-${Math.random().toString(16).slice(2)}-${basename(source)}`
        await rename(source, join(this.quarantineRoot, key))
        return key
    }

    async restore(quarantineKey: string, storageKey: string): Promise<void> {
        const source = this.resolveQuarantinePath(quarantineKey)
        const destination = this.resolveSafePath(storageKey)
        await mkdir(dirname(destination), { recursive: true })
        await rename(source, destination)
    }

    async purgeQuarantine(quarantineKey: string): Promise<void> {
        await rm(this.resolveQuarantinePath(quarantineKey), { force: true })
    }

    private resolveQuarantinePath(quarantineKey: string): string {
        if (
            !quarantineKey ||
            isAbsolute(quarantineKey) ||
            quarantineKey.includes('..') ||
            quarantineKey.includes('\\')
        ) {
            throw new Error('Invalid quarantine key')
        }
        return join(this.quarantineRoot, quarantineKey)
    }
}
