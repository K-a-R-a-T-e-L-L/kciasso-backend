import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common'
import { ApiBearerAuth } from '@nestjs/swagger'

import { ADMIN_CAPABILITY_KEY, AdminCapability, AdminCapabilityGuard } from '../guards/admin-capability.guard'
import { UserGuard } from '../guards/user.guard'

export function RequireAdminCapability(capability: AdminCapability) {
    return applyDecorators(
        SetMetadata(ADMIN_CAPABILITY_KEY, capability),
        ApiBearerAuth(),
        UseGuards(UserGuard, AdminCapabilityGuard)
    )
}
