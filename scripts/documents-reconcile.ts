import 'dotenv/config'

import { NestFactory } from '@nestjs/core'

import { AppModule } from '../src/app.module'
import { DocumentReconciliationService } from '../src/system/documents/services/document-reconciliation.service'

async function main() {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false })
    try {
        const summary = await app.get(DocumentReconciliationService).inspect()
        console.log(JSON.stringify(summary, null, 2))
    } finally {
        await app.close()
    }
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
})
