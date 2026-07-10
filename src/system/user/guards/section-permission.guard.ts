import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { ErrorCodeEnum } from '../../../_helpers/enums/validator/error.code.enum'
import { ErrorDto } from '../../../_helpers/errors/error.dto'
import { UserService } from '../services/user.service'
import { REQUIRED_SECTION_PERMISSION_KEY } from '../decorators/require-section-permission.decorator'

@Injectable()
export class SectionPermissionGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private userService: UserService
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest()
        const user = request.user as { id?: number; is_super_admin?: boolean } | undefined
        const requiredSectionId = this.reflector.getAllAndOverride<string>(REQUIRED_SECTION_PERMISSION_KEY, [
            context.getHandler(),
            context.getClass(),
        ])

        if (!user?.id) {
            throw new ForbiddenException(new ErrorDto(ErrorCodeEnum.NOT_AUTH, 'Forbidden', 403, 'User is not authenticated'))
        }

        if (user.is_super_admin === true) {
            return true
        }

        if (!requiredSectionId) {
            throw new ForbiddenException(
                new ErrorDto(ErrorCodeEnum.NOT_ENOUGH_RIGHTS, 'Forbidden', 403, 'No section permission metadata provided')
            )
        }

        const hasPermission = await this.userService.hasSectionPermission(user.id, requiredSectionId)

        if (!hasPermission) {
            throw new ForbiddenException(
                new ErrorDto(ErrorCodeEnum.NOT_ENOUGH_RIGHTS, 'Forbidden', 403, 'Section permission is required')
            )
        }

        return true
    }
}
