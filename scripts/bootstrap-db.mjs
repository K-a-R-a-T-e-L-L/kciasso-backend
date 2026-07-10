import { Client } from 'pg'

function getDatabaseName(databaseUrl) {
    const pathname = databaseUrl.pathname.replace(/^\/+/, '')

    if (!pathname) {
        throw new Error('DATABASE_URL does not contain a database name.')
    }

    return decodeURIComponent(pathname)
}

function getAdminConnectionString(databaseUrl) {
    const adminUrl = new URL(databaseUrl.toString())
    const bootstrapDatabase = process.env.DATABASE_BOOTSTRAP_DB?.trim() || 'postgres'

    adminUrl.pathname = `/${bootstrapDatabase}`
    adminUrl.searchParams.delete('schema')

    return adminUrl.toString()
}

function escapeIdentifier(value) {
    return value.replace(/"/g, '""')
}

async function ensureDatabaseExists() {
    const databaseUrlValue = process.env.DATABASE_URL

    if (!databaseUrlValue) {
        throw new Error('DATABASE_URL is not set.')
    }

    const databaseUrl = new URL(databaseUrlValue)
    const databaseName = process.env.DATABASE_DB?.trim() || getDatabaseName(databaseUrl)
    const client = new Client({
        connectionString: getAdminConnectionString(databaseUrl),
    })

    await client.connect()

    try {
        const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName])

        if (result.rowCount && result.rowCount > 0) {
            console.log(`[bootstrap-db] Database "${databaseName}" already exists.`)
            return
        }

        await client.query(`CREATE DATABASE "${escapeIdentifier(databaseName)}"`)
        console.log(`[bootstrap-db] Database "${databaseName}" created.`)
    } finally {
        await client.end()
    }
}

ensureDatabaseExists().catch(error => {
    console.error('[bootstrap-db] Failed to ensure database exists.')
    console.error(error)
    process.exit(1)
})
