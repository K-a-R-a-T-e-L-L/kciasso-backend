import { Module } from '@nestjs/common'

import { AdminNewsController } from './controllers/admin-news.controller'
import { AdminNewsMediaController, PublicNewsMediaController } from './controllers/news-media.controller'
import { PublicNewsController } from './controllers/public-news.controller'
import { NewsMediaService } from './media/news-media.service'
import { NewsService } from './services/news.service'
import { UserModule } from '../user/user.module'

@Module({
    imports: [UserModule],
    controllers: [PublicNewsController, AdminNewsController, AdminNewsMediaController, PublicNewsMediaController],
    providers: [NewsService, NewsMediaService],
})
export class NewsModule {}
