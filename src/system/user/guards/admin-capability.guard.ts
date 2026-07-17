import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { ErrorCodeEnum } from '../../../_helpers/enums/validator/error.code.enum'
import { ErrorDto } from '../../../_helpers/errors/error.dto'
import { UserService } from '../services/user.service'

export type AdminCapability = 'news' | 'site-settings'
export const ADMIN_CAPABILITY_KEY = 'adminCapability'

@Injectable()
export class AdminCapabilityGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly userService: UserService
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const user = context.switchToHttp().getRequest().user as { id?: number } | undefined
        const capability = this.reflector.getAllAndOverride<AdminCapability>(ADMIN_CAPABILITY_KEY, [
            context.getHandler(),
            context.getClass(),
        ])
        if (!user?.id || !capability || !(await this.userService.hasCapability(user.id, capability))) {
            throw new ForbiddenException(
                new ErrorDto(ErrorCodeEnum.NOT_ENOUGH_RIGHTS, 'Forbidden', 403, 'Required admin capability is missing')
            )
        }
        return true
    }
}
