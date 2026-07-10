import { Module } from '@nestjs/common'

import { UserModule } from '../user/user.module'
import { AdminNewsController } from './controllers/admin-news.controller'
import { PublicNewsController } from './controllers/public-news.controller'
import { NewsService } from './services/news.service'

@Module({
    imports: [UserModule],
    controllers: [PublicNewsController, AdminNewsController],
    providers: [NewsService],
})
export class NewsModule {}
