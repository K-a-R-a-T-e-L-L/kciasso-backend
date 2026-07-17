import { ConfigService } from '@nestjs/config'

export type AppConfig = {
    nodeEnv: string
    port: number
    frontendUrl: string
    uploadsDir: string
    publicUploadsUrl: string
    documentStorageRoot: string
    documentTempRoot: string
    documentMaxFileSizeBytes: number
    newsMediaRoot: string
}

export function getAppConfig(configService: ConfigService): AppConfig {
    return {
        nodeEnv: configService.getOrThrow<string>('NODE_ENV'),
        port: configService.getOrThrow<number>('PORT'),
        frontendUrl: configService.getOrThrow<string>('FRONTEND_URL'),
        uploadsDir: configService.getOrThrow<string>('UPLOADS_DIR'),
        publicUploadsUrl: configService.getOrThrow<string>('PUBLIC_UPLOADS_URL'),
        documentStorageRoot: configService.getOrThrow<string>('DOCUMENT_STORAGE_ROOT'),
        documentTempRoot: configService.getOrThrow<string>('DOCUMENT_TEMP_ROOT'),
        documentMaxFileSizeBytes: configService.getOrThrow<number>('DOCUMENT_MAX_FILE_SIZE_MB') * 1024 * 1024,
        newsMediaRoot: configService.getOrThrow<string>('NEWS_MEDIA_ROOT'),
    }
}
