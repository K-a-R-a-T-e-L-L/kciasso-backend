import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'

import { UserService } from '../services/user.service'

@Injectable()
export class UserGuard implements CanActivate {
    constructor(private userService: UserService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest()
        const token = request.headers.authorization

        if (token?.startsWith('Bearer ')) {
            const session = await this.userService.findSessionByToken(token.slice('Bearer '.length))
            if (!session) throw new UnauthorizedException('Authentication session is invalid or inactive')

            request.session = session
            request.user = session.user

            return true
        }
        throw new UnauthorizedException('Bearer token is required')
    }
}
