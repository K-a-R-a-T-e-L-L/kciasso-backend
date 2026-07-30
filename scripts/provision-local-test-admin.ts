import 'dotenv/config'

import { PrismaClient } from '@prisma/client'
import * as bcryptjs from 'bcryptjs'

const prisma = new PrismaClient()

function assertSafeTarget() {
    if (process.env.ALLOW_LOCAL_TEST_ADMIN_PROVISION !== 'true') {
        throw new Error('ALLOW_LOCAL_TEST_ADMIN_PROVISION must be true')
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Local test admin provisioning is forbidden in production')
    }
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('DATABASE_URL is required')
    const url = new URL(databaseUrl)
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Database host is not local')
    if (url.pathname.replace(/^\//, '') !== 'kciasso_backend_dev') throw new Error('Database name is not kciasso_backend_dev')
}

async function main() {
    assertSafeTarget()
    const email = process.env.M8_ADMIN_EMAIL ?? ''
    const password = process.env.M8_ADMIN_PASSWORD ?? ''
    if (!/^mantine-m8-[a-z0-9-]+@local\.test$/.test(email)) throw new Error('Email is not task-owned')
    if (password.length < 24) throw new Error('Task password is too short')

    const passwordHash = await bcryptjs.hash(password, 10)
    const user = await prisma.user.upsert({
        where: { email },
        create: {
            name: `Mantine M8 ${email.slice(12, -11)}`,
            email,
            password: passwordHash,
            is_super_admin: true,
            is_active: true,
            can_manage_site_settings: true,
            can_manage_news: true,
            documents_access_mode: 'ALL',
            document_groups: [],
        },
        update: {
            password: passwordHash,
            is_super_admin: true,
            is_active: true,
            can_manage_site_settings: true,
            can_manage_news: true,
            documents_access_mode: 'ALL',
            document_groups: [],
            deleted_at: null,
        },
        select: { id: true, email: true },
    })
    console.log(JSON.stringify(user))
}

main()
    .catch(error => {
        console.error(error instanceof Error ? error.message : 'Provisioning failed')
        process.exitCode = 1
    })
    .finally(async () => prisma.$disconnect())
