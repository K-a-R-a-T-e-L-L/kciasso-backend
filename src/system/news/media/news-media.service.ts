import { randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { NewsImageFile, validateNewsImage } from './news-media.policy'
import { PrismaService } from '../../../prisma/prisma.service'

const KEY_PATTERN = /^[a-f0-9]{64}\.(?:jpg|png|webp)$/
const PUBLIC_PREFIX = '/api/public/news/media/'

@Injectable()
export class NewsMediaService implements OnModuleInit {
    private readonly root: string

    constructor(
        config: ConfigService,
        private readonly prisma: PrismaService
    ) {
        this.root = config.getOrThrow<string>('NEWS_MEDIA_ROOT')
    }

    async onModuleInit() {
        await mkdir(this.root, { recursive: true })
    }

    async store(file: NewsImageFile) {
        const type = validateNewsImage(file)
        const key = `${randomBytes(32).toString('hex')}.${type.extension}`
        await writeFile(this.pathForKey(key), file.buffer, { flag: 'wx' })
        return { key, url: `${PUBLIC_PREFIX}${key}` }
    }

    async open(key: string) {
        const path = this.pathForKey(key)
        try {
            const info = await stat(path)
            const extension = key.slice(key.lastIndexOf('.') + 1)
            return {
                stream: createReadStream(path),
                size: info.size,
                mimeType: extension === 'jpg' ? 'image/jpeg' : `image/${extension}`,
            }
        } catch {
            throw new NotFoundException('News image not found')
        }
    }

    async deleteIfUnreferenced(key: string): Promise<boolean> {
        const url = `${PUBLIC_PREFIX}${key}`
        if ((await this.prisma.news.count({ where: { cover_image_url: url, deleted_at: null } })) > 0) return false
        await rm(this.pathForKey(key), { force: true })
        return true
    }

    async deleteOwnedUrlIfUnreferenced(url?: string | null): Promise<boolean> {
        const key = this.keyFromOwnedUrl(url)
        return key ? this.deleteIfUnreferenced(key) : false
    }

    keyFromOwnedUrl(url?: string | null): string | null {
        if (!url?.startsWith(PUBLIC_PREFIX)) return null
        const key = url.slice(PUBLIC_PREFIX.length)
        return KEY_PATTERN.test(key) ? key : null
    }

    private pathForKey(key: string): string {
        if (!KEY_PATTERN.test(key)) throw new NotFoundException('News image not found')
        return join(this.root, key)
    }
}
