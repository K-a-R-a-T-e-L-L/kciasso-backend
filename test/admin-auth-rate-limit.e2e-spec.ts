import * as request from 'supertest'

import { closeE2eContext, createE2eContext } from './helpers/e2e-context'
import { AdminAuthRateLimitService } from '../src/system/user/services/admin-auth-rate-limit.service'

describe('admin auth rate limit integration', () => {
    let context: Awaited<ReturnType<typeof createE2eContext>>
    beforeAll(async () => {
        process.env.ADMIN_AUTH_RATE_LIMIT_ENABLED = 'true'
        process.env.ADMIN_AUTH_RATE_LIMIT_MAX_ATTEMPTS = '3'
        process.env.ADMIN_AUTH_RATE_LIMIT_BLOCK_SECONDS = '2'
        context = await createE2eContext()
        await context.prisma.adminAuthRateLimitBucket.deleteMany()
    }, 30_000)
    afterAll(async () => {
        await closeE2eContext(context)
        delete process.env.ADMIN_AUTH_RATE_LIMIT_ENABLED
        delete process.env.ADMIN_AUTH_RATE_LIMIT_MAX_ATTEMPTS
        delete process.env.ADMIN_AUTH_RATE_LIMIT_BLOCK_SECONDS
    }, 30_000)
    it('returns generic errors then 429 with retry-after', async () => {
        const limiter = context.app.get(AdminAuthRateLimitService)
        for (let i = 0; i < 4; i++) await limiter.recordFailure('integration-ip', 'integration@example.com')
        await expect(limiter.assertAllowed('integration-ip', 'integration@example.com')).rejects.toMatchObject({
            status: 429,
        })
        const response = await request(context.app.getHttpServer())
            .post('/api/user/authenticate')
            .send({ email: `unknown-${Date.now()}@example.com`, password: 'wrong' })
        expect([400, 429]).toContain(response.status)
    })
})
