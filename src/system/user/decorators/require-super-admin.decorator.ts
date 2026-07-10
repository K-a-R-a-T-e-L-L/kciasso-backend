import { UseGuards, applyDecorators } from '@nestjs/common'
import { ApiBearerAuth } from '@nestjs/swagger'

import { SuperAdminGuard } from '../guards/super-admin.guard'
import { UserGuard } from '../guards/user.guard'

export function RequireSuperAdmin() {
    return applyDecorators(ApiBearerAuth(), UseGuards(UserGuard, SuperAdminGuard))
}
