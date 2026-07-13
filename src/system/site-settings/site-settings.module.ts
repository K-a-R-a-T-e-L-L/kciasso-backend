import { Module } from '@nestjs/common'

import { UserModule } from '../user/user.module'
import { AdminSiteSettingsController } from './controllers/admin-site-settings.controller'
import { PublicSiteSettingsController } from './controllers/public-site-settings.controller'
import { SiteSettingsService } from './services/site-settings.service'

@Module({
    imports: [UserModule],
    controllers: [PublicSiteSettingsController, AdminSiteSettingsController],
    providers: [SiteSettingsService],
    exports: [SiteSettingsService],
})
export class SiteSettingsModule {}
