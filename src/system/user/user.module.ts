import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { UserController } from './controllers/user.controller'
import { AdminCapabilityGuard } from './guards/admin-capability.guard'
import { SuperAdminGuard } from './guards/super-admin.guard'
import { UserService } from './services/user.service'

@Module({
    imports: [JwtModule],
    providers: [UserService, SuperAdminGuard, AdminCapabilityGuard],
    controllers: [UserController],
    exports: [UserService],
})
export class UserModule {}
