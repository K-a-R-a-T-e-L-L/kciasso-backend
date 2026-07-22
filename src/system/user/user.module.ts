import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { UserController } from './controllers/user.controller'
import { AdminCapabilityGuard } from './guards/admin-capability.guard'
import { SuperAdminGuard } from './guards/super-admin.guard'
import { AdminAuthRateLimitService } from './services/admin-auth-rate-limit.service'
import { UserService } from './services/user.service'

@Module({
    imports: [JwtModule],
    providers: [UserService, AdminAuthRateLimitService, SuperAdminGuard, AdminCapabilityGuard],
    controllers: [UserController],
    exports: [UserService, AdminAuthRateLimitService],
})
export class UserModule {}
