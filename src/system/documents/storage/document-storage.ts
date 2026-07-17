import { createReadStream } from 'node:fs'

export abstract class DocumentStorage {
    abstract moveTempFile(tempPath: string, storageKey: string): Promise<void>
    abstract createReadStream(storageKey: string): ReturnType<typeof createReadStream>
    abstract delete(storageKey: string): Promise<void>
    abstract exists(storageKey: string): Promise<boolean>
    abstract listStorageKeys(): Promise<string[]>
    abstract listTempFiles(olderThan: Date): Promise<number>
    abstract quarantine(storageKey: string): Promise<string>
    abstract restore(quarantineKey: string, storageKey: string): Promise<void>
    abstract purgeQuarantine(quarantineKey: string): Promise<void>
}
