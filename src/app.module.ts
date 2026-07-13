import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { validationSchema } from './env.validation'
import { PrismaModule } from './prisma/prisma.module'
import { NewsModule } from './system/news/news.module'
import { SiteSettingsModule } from './system/site-settings/site-settings.module'
import { UserModule } from './system/user/user.module'

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validationSchema,
        }),
        PrismaModule,
        UserModule,
        NewsModule,
        SiteSettingsModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
