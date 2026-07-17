import 'dotenv/config'

import { execSync } from 'child_process'
import { join } from 'path'

import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import { Client } from 'pg'

import {
    seedNews,
    seedNewsCategories,
    seedSections,
    seedSiteSettings,
    seedSuperAdminSafe,
} from '../../prisma/seed.helpers'
import { DocumentStorage } from '../../src/system/documents/storage/document-storage'

type E2eContextOptions = {
    documentStorage?: DocumentStorage
}

const repoRoot = join(__dirname, '..', '..')

function deriveE2eDatabaseUrl(sourceDatabaseUrl: string) {
    const databaseUrl = new URL(sourceDatabaseUrl)
    const databaseName = databaseUrl.pathname.replace(/^\/+/, '')

    databaseUrl.pathname = `/${databaseName}_e2e`

    return databaseUrl.toString()
}

function getE2eDatabaseUrl() {
    const configuredUrl = process.env.E2E_DATABASE_URL?.trim()

    if (configuredUrl) {
        return configuredUrl
    }

    const sourceDatabaseUrl = process.env.DATABASE_URL?.trim()

    if (!sourceDatabaseUrl) {
        throw new Error('DATABASE_URL is not set. Unable to derive E2E database URL.')
    }

    return deriveE2eDatabaseUrl(sourceDatabaseUrl)
}

function getDatabaseName(databaseUrl: string) {
    return new URL(databaseUrl).pathname.replace(/^\/+/, '')
}

function getAdminDatabaseUrl(databaseUrl: string) {
    const adminDatabaseUrl = new URL(databaseUrl)

    adminDatabaseUrl.pathname = '/postgres'
    adminDatabaseUrl.search = ''

    return adminDatabaseUrl.toString()
}

function quoteIdentifier(identifier: string) {
    return `"${identifier.replace(/"/g, '""')}"`
}

function applyE2eEnv(databaseUrl: string) {
    const parsedUrl = new URL(databaseUrl)
    const databaseName = getDatabaseName(databaseUrl)

    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = databaseUrl
    process.env.DATABASE_HOST = parsedUrl.hostname
    process.env.DATABASE_PORT = parsedUrl.port || '5432'
    process.env.DATABASE_PORT_OUT = parsedUrl.port || '5432'
    process.env.DATABASE_USER = decodeURIComponent(parsedUrl.username)
    process.env.DATABASE_PASSWORD = decodeURIComponent(parsedUrl.password)
    process.env.DATABASE_DB = databaseName
}

async function resetDatabase(databaseUrl: string) {
    const databaseName = getDatabaseName(databaseUrl)
    const adminClient = new Client({
        connectionString: getAdminDatabaseUrl(databaseUrl),
    })

    await adminClient.connect()
    await adminClient.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
        [databaseName]
    )
    await adminClient.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`)
    await adminClient.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`)
    await adminClient.end()
}

function runMigrations(databaseUrl: string) {
    execSync('npx prisma migrate deploy', {
        cwd: repoRoot,
        env: {
            ...process.env,
            DATABASE_URL: databaseUrl,
        },
        stdio: 'inherit',
    })
}

async function seedFoundation(prisma: PrismaClient) {
    await seedSections(prisma)
    await seedSiteSettings(prisma)
    await seedNewsCategories(prisma)
    await seedNews(prisma)
    await seedSuperAdminSafe(prisma, {
        email: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
        password: process.env.SUPER_ADMIN_PASSWORD || 'change_me_12345',
    })
}

export async function createE2eContext(options: E2eContextOptions = {}) {
    const databaseUrl = getE2eDatabaseUrl()

    applyE2eEnv(databaseUrl)
    await resetDatabase(databaseUrl)
    runMigrations(databaseUrl)

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: databaseUrl,
            },
        },
    })

    await prisma.$connect()
    await seedFoundation(prisma)

    const { AppModule } = await import('../../src/app.module')
    const { configureApp } = await import('../../src/app.factory')
    const testingModule = Test.createTestingModule({
        imports: [AppModule],
    })
    if (options.documentStorage) {
        testingModule.overrideProvider(DocumentStorage).useValue(options.documentStorage)
    }
    const moduleRef = await testingModule.compile()

    const app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()

    return {
        app,
        prisma,
        databaseUrl,
    }
}

export async function closeE2eContext(context?: { app: INestApplication; prisma: PrismaClient }) {
    if (!context) {
        return
    }

    await context.app.close()
    await context.prisma.$disconnect()
}
