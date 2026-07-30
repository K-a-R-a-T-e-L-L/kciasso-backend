import { Module } from '@nestjs/common'

import { PagesController } from './pages.controller'
import { PagesService } from './pages.service'
import { UserModule } from '../user/user.module'

@Module({
    imports: [UserModule],
    controllers: [PagesController],
    providers: [PagesService],
    exports: [PagesService],
})
export class PagesModule {}
