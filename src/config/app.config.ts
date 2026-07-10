import { ConfigService } from '@nestjs/config'

export type AppConfig = {
    nodeEnv: string
    port: number
    frontendUrl: string
    uploadsDir: string
    publicUploadsUrl: string
}

export function getAppConfig(configService: ConfigService): AppConfig {
    return {
        nodeEnv: configService.getOrThrow<string>('NODE_ENV'),
        port: configService.getOrThrow<number>('PORT'),
        frontendUrl: configService.getOrThrow<string>('FRONTEND_URL'),
        uploadsDir: configService.getOrThrow<string>('UPLOADS_DIR'),
        publicUploadsUrl: configService.getOrThrow<string>('PUBLIC_UPLOADS_URL'),
    }
}
