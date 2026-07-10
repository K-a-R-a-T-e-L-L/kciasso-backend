import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import { configureApp } from './app.factory'
import { getAppConfig } from './config/app.config'
import { ConfigService } from '@nestjs/config'

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bodyParser: true })
    const configService = app.get(ConfigService)
    const appConfig = getAppConfig(configService)
    configureApp(app)

    await app.listen(appConfig.port)
}

bootstrap().then(() => {})
