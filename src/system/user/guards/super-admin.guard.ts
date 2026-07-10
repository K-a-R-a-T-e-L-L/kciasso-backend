import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'

import { ErrorCodeEnum } from '../../../_helpers/enums/validator/error.code.enum'
import { ErrorDto } from '../../../_helpers/errors/error.dto'

@Injectable()
export class SuperAdminGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest()
        const user = request.user as { is_super_admin?: boolean } | undefined

        if (user?.is_super_admin === true) {
            return true
        }

        throw new ForbiddenException(
            new ErrorDto(ErrorCodeEnum.NOT_ENOUGH_RIGHTS, 'Forbidden', 403, 'Super admin access is required')
        )
    }
}
