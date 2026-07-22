import { createHash } from 'node:crypto'

import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { PrismaService } from '../../../prisma/prisma.service'

@Injectable()
export class AdminAuthRateLimitService {
    private readonly enabled: boolean
    private readonly windowMs: number
    private readonly maxAttempts: number
    private readonly blockMs: number

    constructor(
        private readonly prisma: PrismaService,
        config: ConfigService
    ) {
        this.enabled = config.get<boolean>('ADMIN_AUTH_RATE_LIMIT_ENABLED', true)
        this.windowMs = config.get<number>('ADMIN_AUTH_RATE_LIMIT_WINDOW_SECONDS', 60) * 1000
        this.maxAttempts = config.get<number>('ADMIN_AUTH_RATE_LIMIT_MAX_ATTEMPTS', 3)
        this.blockMs = config.get<number>('ADMIN_AUTH_RATE_LIMIT_BLOCK_SECONDS', 60) * 1000
    }

    async assertAllowed(ip: string, login: string): Promise<void> {
        if (!this.enabled) return
        const now = new Date()
        const keys = [this.key('ip', ip), this.key('credential', `${ip}:${login.trim().toLowerCase()}`)]
        const buckets = await this.prisma.adminAuthRateLimitBucket.findMany({ where: { key_hash: { in: keys } } })
        const blocked = buckets.find(bucket => bucket.blocked_until && bucket.blocked_until > now)
        if (blocked?.blocked_until) {
            const error = new HttpException('Too many authentication attempts', HttpStatus.TOO_MANY_REQUESTS)
            error.getResponse = () => ({
                statusCode: 429,
                message: 'Too many authentication attempts',
                retryAfter: Math.ceil((blocked.blocked_until!.getTime() - now.getTime()) / 1000),
            })
            throw error
        }
    }

    async recordFailure(ip: string, login: string): Promise<void> {
        if (!this.enabled) return
        await this.updateBucket('ip', ip)
        await this.updateBucket('credential', `${ip}:${login.trim().toLowerCase()}`)
    }

    async recordSuccess(ip: string, login: string): Promise<void> {
        if (!this.enabled) return
        await this.prisma.adminAuthRateLimitBucket.deleteMany({
            where: { key_hash: this.key('credential', `${ip}:${login.trim().toLowerCase()}`) },
        })
    }

    private async updateBucket(type: string, value: string) {
        const now = new Date()
        const keyHash = this.key(type, value)
        const bucket = await this.prisma.adminAuthRateLimitBucket.findUnique({ where: { key_hash: keyHash } })
        const expired = !bucket || now.getTime() - bucket.window_started_at.getTime() >= this.windowMs
        const attempts = expired ? 1 : bucket.attempts + 1
        const blockedUntil = attempts > this.maxAttempts ? new Date(now.getTime() + this.blockMs) : null
        await this.prisma.adminAuthRateLimitBucket.upsert({
            where: { key_hash: keyHash },
            create: {
                key_hash: keyHash,
                bucket_type: type,
                window_started_at: now,
                attempts,
                blocked_until: blockedUntil,
            },
            update: {
                window_started_at: expired ? now : bucket.window_started_at,
                attempts,
                blocked_until: blockedUntil,
            },
        })
    }

    private key(type: string, value: string) {
        return createHash('sha256').update(`${type}:${value}`).digest('hex')
    }
}
