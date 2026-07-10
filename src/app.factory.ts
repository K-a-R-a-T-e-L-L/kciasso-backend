import { ClassSerializerInterceptor, INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { useContainer } from 'class-validator'

import { CustomValidationPipe } from './_helpers/pipes/custom-validation-pipe'
import { AppModule } from './app.module'
import { getAppConfig } from './config/app.config'

export function configureApp(app: INestApplication) {
    const configService = app.get(ConfigService)
    const appConfig = getAppConfig(configService)

    app.setGlobalPrefix('api')
    app.enableCors({
        origin: [appConfig.frontendUrl],
        credentials: true,
    })
    app.useGlobalPipes(
        new CustomValidationPipe({
            transform: true,
            transformOptions: { enableImplicitConversion: true },
            whitelist: true,
        })
    )
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)))
    useContainer(app.select(AppModule), { fallbackOnErrors: true })

    const swaggerConfig = new DocumentBuilder()
        .setTitle('KCIASSO API')
        .setDescription('Backend foundation and OpenAPI contract for the KCIASSO website.')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('docs', app, document, {
        useGlobalPrefix: true,
        jsonDocumentUrl: 'docs-json',
        swaggerOptions: {
            persistAuthorization: true,
        },
    })
}
