import { createHash } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { isIP } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Agent, fetch as undiciFetch } from 'undici'

import { NEWS_IMAGE_MAX_BYTES, NewsImageFile, validateNewsImage } from './news-media.policy'
import { PrismaService } from '../../../prisma/prisma.service'

const KEY_PATTERN = /^[a-f0-9]{64}\.(?:jpg|png|webp)$/
const PUBLIC_PREFIX = '/api/public/news/media/'

@Injectable()
export class NewsMediaDnsResolver {
    async resolve(hostname: string) {
        const records = await lookup(hostname, { all: true })
        const publicRecord = records.find(record => !this.forbiddenIp(record.address))
        if (!publicRecord || records.some(record => this.forbiddenIp(record.address)))
            throw new BadRequestException('Image URL is not allowed')
        return publicRecord.address
    }
    private forbiddenIp(value: string) {
        if (isIP(value) === 4) {
            const [a, b] = value.split('.').map(Number)
            return (
                a === 0 ||
                a === 10 ||
                a === 127 ||
                (a === 169 && b === 254) ||
                (a === 172 && b >= 16 && b <= 31) ||
                (a === 192 && b === 168) ||
                a >= 224 ||
                (a === 100 && b >= 64 && b <= 127)
            )
        }
        const v = value.toLowerCase()
        return (
            v === '::1' ||
            v.startsWith('fc') ||
            v.startsWith('fd') ||
            v.startsWith('fe80') ||
            v.startsWith('::ffff:10.') ||
            v.startsWith('::ffff:192.168.')
        )
    }
}

@Injectable()
export class NewsMediaDispatcherFactory {
    create(hostname: string, ip: string) {
        return new Agent({
            connect: {
                lookup: (
                    _host: string,
                    _options: unknown,
                    callback: (error: Error | null, address?: string, family?: number) => void
                ) => callback(null, ip, isIP(ip)),
            },
        } as any)
    }
}

@Injectable()
export class NewsMediaRemoteFetcher {
    constructor(
        private readonly config: ConfigService,
        private readonly dns: NewsMediaDnsResolver,
        private readonly dispatchers: NewsMediaDispatcherFactory
    ) {}

    async fetch(rawUrl: string) {
        let current: URL
        try {
            current = new URL(rawUrl)
        } catch {
            throw new BadRequestException('Invalid image URL')
        }
        const maxRedirects = this.config.get<number>('NEWS_MEDIA_IMPORT_MAX_REDIRECTS', 3)
        const maxBytes = this.config.get<number>('NEWS_MEDIA_IMPORT_MAX_BYTES', NEWS_IMAGE_MAX_BYTES)
        const timeout = this.config.get<number>('NEWS_MEDIA_IMPORT_TIMEOUT_MS', 15000)
        for (let count = 0; count <= maxRedirects; count += 1) {
            const controlledIp = this.controlledSourceIp(current)
            const ip = controlledIp ?? (await this.resolvePublicIp(current))
            const dispatcher = controlledIp ? undefined : this.dispatchers.create(current.hostname, ip)
            const requestUrl = controlledIp ? new URL(current) : current
            if (controlledIp) requestUrl.hostname = controlledIp
            try {
                const response = await undiciFetch(requestUrl, {
                    dispatcher,
                    redirect: 'manual',
                    signal: AbortSignal.timeout(timeout),
                    headers: {
                        Accept: 'image/jpeg,image/png,image/webp',
                        'User-Agent': 'KCIASSO-NewsMedia/1.0',
                        ...(controlledIp ? { Host: current.host } : {}),
                    },
                })
                if (response.status >= 300 && response.status < 400) {
                    if (count === maxRedirects) throw new BadRequestException('Too many redirects')
                    const location = response.headers.get('location')
                    if (!location) throw new BadRequestException('Image is unavailable')
                    current = new URL(location, current)
                    continue
                }
                if (!response.ok || !response.body) throw new BadRequestException('Image is unavailable')
                const contentLength = Number(response.headers.get('content-length') ?? 0)
                if (contentLength > maxBytes) throw new BadRequestException('Image is too large')
                const dir = await mkdtemp(join(tmpdir(), 'kciasso-news-'))
                const filePath = join(dir, 'remote')
                let size = 0
                try {
                    const input = Readable.fromWeb(response.body as any)
                    const counted = new Transform({
                        transform(chunk, _encoding, callback) {
                            size += chunk.length
                            callback(size > maxBytes ? new Error('LIMIT') : null, chunk)
                        },
                    })
                    await pipeline(input, counted, createWriteStream(filePath, { flags: 'wx' }))
                    const buffer = await readFile(filePath)
                    if (!buffer.length) throw new BadRequestException('Image is empty')
                    const signature = buffer
                        .subarray(0, 8)
                        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
                        ? { extension: 'png' as const, mime: 'image/png' }
                        : buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
                          ? { extension: 'webp' as const, mime: 'image/webp' }
                          : buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
                            ? { extension: 'jpg' as const, mime: 'image/jpeg' }
                            : null
                    if (!signature) throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed')
                    return { originalname: `remote.${signature.extension}`, mimetype: signature.mime, size, buffer }
                } catch (error: any) {
                    if (error?.message === 'LIMIT') throw new BadRequestException('Image is too large')
                    throw error
                } finally {
                    await rm(dir, { recursive: true, force: true })
                }
            } finally {
                await dispatcher?.close()
            }
        }
        throw new BadRequestException('Image is unavailable')
    }

    private async resolvePublicIp(url: URL) {
        if (
            !['http:', 'https:'].includes(url.protocol) ||
            url.username ||
            url.password ||
            !['', '80', '443'].includes(url.port) ||
            url.hostname === 'localhost' ||
            url.hostname.endsWith('.localhost')
        )
            throw new BadRequestException('Image URL is not allowed')
        return this.dns.resolve(url.hostname)
    }

    private controlledSourceIp(url: URL) {
        const enabled = this.config.get<boolean>('NEWS_MEDIA_IMPORT_TEST_SOURCE_ENABLED', false)
        const host = this.config.get<string>('NEWS_MEDIA_IMPORT_TEST_HOST')
        const port = String(this.config.get<number>('NEWS_MEDIA_IMPORT_TEST_PORT', 0))
        if (enabled && host === url.hostname && port === url.port)
            return this.config.get<string>('NEWS_MEDIA_IMPORT_TEST_IP') ?? '127.0.0.1'
        return null
    }
}

@Injectable()
export class NewsMediaService implements OnModuleInit {
    private readonly root: string
    private readonly importEnabled: boolean
    private readonly pendingTtlHours: number
    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
        private readonly remote: NewsMediaRemoteFetcher
    ) {
        this.root = config.getOrThrow<string>('NEWS_MEDIA_ROOT')
        this.importEnabled = config.get<boolean>('NEWS_MEDIA_REMOTE_IMPORT_ENABLED', true)
        this.pendingTtlHours = config.get<number>('NEWS_MEDIA_PENDING_TTL_HOURS', 24)
    }
    async onModuleInit() {
        await mkdir(this.root, { recursive: true })
    }
    async onApplicationBootstrap() {
        await this.cleanupPending()
    }
    @Cron(CronExpression.EVERY_HOUR)
    async scheduledCleanup() {
        await this.cleanupPending()
    }
    async cleanupPending(now = new Date()) {
        const cutoff = new Date(now.getTime() - this.pendingTtlHours * 60 * 60 * 1000)
        const candidates = await this.prisma.newsMedia.findMany({
            where: { created_at: { lt: cutoff }, status: { in: ['PENDING', 'READY'] }, news: { none: {} } },
            select: { id: true, storage_key: true },
        })
        let quarantined = 0
        let deleted = 0
        let skipped = 0
        for (const candidate of candidates) {
            const marked = await this.prisma.newsMedia.updateMany({
                where: { id: candidate.id, news: { none: {} }, status: { in: ['PENDING', 'READY'] } },
                data: { quarantined_at: now },
            })
            if (!marked.count) {
                skipped += 1
                continue
            }
            quarantined += 1
            const stillReferenced = await this.prisma.newsMedia.findFirst({
                where: { id: candidate.id, news: { some: {} } },
                select: { id: true },
            })
            if (stillReferenced) {
                skipped += 1
                continue
            }
            await rm(this.pathForKey(candidate.storage_key), { force: true })
            await this.prisma.newsMedia.deleteMany({
                where: { id: candidate.id, news: { none: {} }, quarantined_at: now },
            })
            deleted += 1
        }
        return { candidates: candidates.length, quarantined, deleted, skipped }
    }
    async store(file: NewsImageFile, sourceUrl?: string) {
        const type = validateNewsImage(file)
        const sha256 = createHash('sha256').update(file.buffer).digest('hex')
        const existing = await this.prisma.newsMedia.findUnique({ where: { sha256 } })
        if (existing?.status === 'READY') {
            const existsOnDisk = await stat(this.pathForKey(existing.storage_key))
                .then(() => true)
                .catch(() => false)
            if (existsOnDisk) {
                if (sourceUrl && !existing.source_url)
                    await this.prisma.newsMedia.update({
                        where: { id: existing.id },
                        data: { source_url: sourceUrl, imported_at: new Date() },
                    })
                return this.result(existing.id, existing.storage_key)
            }
        }
        const key = `${sha256}.${type.extension}`
        await writeFile(this.pathForKey(key), file.buffer).catch(() => undefined)
        try {
            const media = existing
                ? await this.prisma.newsMedia.update({
                      where: { id: existing.id },
                      data: {
                          storage_key: key,
                          mime_type: type.mimeType,
                          extension: type.extension,
                          size_bytes: file.size,
                          status: 'READY',
                          ...(sourceUrl ? { source_url: sourceUrl, imported_at: new Date() } : {}),
                      },
                  })
                : await this.prisma.newsMedia.create({
                      data: {
                          sha256,
                          storage_key: key,
                          mime_type: type.mimeType,
                          extension: type.extension,
                          size_bytes: file.size,
                          status: 'READY',
                          ...(sourceUrl ? { source_url: sourceUrl, imported_at: new Date() } : {}),
                      },
                  })
            return this.result(media.id, media.storage_key)
        } catch (error: any) {
            if (error?.code !== 'P2002') throw error
            const media = await this.prisma.newsMedia.findUniqueOrThrow({ where: { sha256 } })
            return this.result(media.id, media.storage_key)
        }
    }
    async importFromUrl(url: string) {
        if (!this.importEnabled) throw new BadRequestException('Remote image import is disabled')
        return this.store(await this.remote.fetch(url), url)
    }
    async probeImportUrl(url: string) {
        if (!this.importEnabled) throw new BadRequestException('Remote image import is disabled')
        await this.remote.fetch(url)
    }
    async open(key: string) {
        const path = this.pathForKey(key)
        try {
            const info = await stat(path)
            const ext = key.slice(key.lastIndexOf('.') + 1)
            return {
                stream: createReadStream(path),
                size: info.size,
                mimeType: ext === 'jpg' ? 'image/jpeg' : `image/${ext}`,
            }
        } catch {
            throw new NotFoundException('News image not found')
        }
    }
    async deleteIfUnreferenced(key: string) {
        const deleted = await this.prisma.newsMedia.deleteMany({
            where: { storage_key: key, news: { none: { deleted_at: null } } },
        })
        if (!deleted.count) return false
        await rm(this.pathForKey(key), { force: true })
        return true
    }
    async deleteOwnedUrlIfUnreferenced(url?: string | null) {
        const key = this.keyFromOwnedUrl(url)
        return key ? this.deleteIfUnreferenced(key) : false
    }
    keyFromOwnedUrl(url?: string | null) {
        if (!url?.startsWith(PUBLIC_PREFIX)) return null
        const key = url.slice(PUBLIC_PREFIX.length)
        return KEY_PATTERN.test(key) ? key : null
    }
    private result(mediaId: number, key: string) {
        return { mediaId, key, url: `${PUBLIC_PREFIX}${key}` }
    }
    private pathForKey(key: string) {
        if (!KEY_PATTERN.test(key)) throw new NotFoundException('News image not found')
        return join(this.root, key)
    }
}
