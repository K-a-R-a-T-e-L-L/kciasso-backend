import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { SectionPermissionGuard } from './guards/section-permission.guard'
import { SuperAdminGuard } from './guards/super-admin.guard'
import { UserController } from './controllers/user.controller'
import { UserService } from './services/user.service'

@Module({
    imports: [JwtModule],
    providers: [UserService, SectionPermissionGuard, SuperAdminGuard],
    controllers: [UserController],
    exports: [UserService],
})
export class UserModule {}
