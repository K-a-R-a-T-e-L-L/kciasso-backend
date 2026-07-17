import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'

import { configureApp } from './app.factory'
import { AppModule } from './app.module'
import { getAppConfig } from './config/app.config'
import { ensureDocumentStorageDirectories } from './system/documents/storage/document-storage.config'

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bodyParser: true })
    const configService = app.get(ConfigService)
    const appConfig = getAppConfig(configService)
    configureApp(app)
    await ensureDocumentStorageDirectories(appConfig.documentStorageRoot, appConfig.documentTempRoot)

    await app.listen(appConfig.port)
}

bootstrap().then(() => {})
