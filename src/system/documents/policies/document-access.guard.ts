import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { DocumentsAccessMode, User } from '@prisma/client'

@Injectable()
export class DocumentAccessGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const user = context.switchToHttp().getRequest().user as User | undefined
        if (
            user?.is_super_admin ||
            user?.documents_access_mode === DocumentsAccessMode.ALL ||
            (user?.documents_access_mode === DocumentsAccessMode.SELECTED_GROUPS && user.document_groups.length > 0)
        )
            return true
        throw new ForbiddenException('Document access is required')
    }
}
