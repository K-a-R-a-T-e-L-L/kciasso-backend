import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common'
import { ApiBearerAuth } from '@nestjs/swagger'

import { SectionPermissionGuard } from '../guards/section-permission.guard'
import { UserGuard } from '../guards/user.guard'

export const REQUIRED_SECTION_PERMISSION_KEY = 'requiredSectionPermission'

export function RequireSectionPermission(sectionId: string) {
    return applyDecorators(
        SetMetadata(REQUIRED_SECTION_PERMISSION_KEY, sectionId),
        ApiBearerAuth(),
        UseGuards(UserGuard, SectionPermissionGuard)
    )
}
