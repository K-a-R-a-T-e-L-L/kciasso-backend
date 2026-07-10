import { ApiProperty } from '@nestjs/swagger'

import { AdminUserDto } from './admin-user.dto'

export class UserPermissionsDto {
    @ApiProperty({
        type: () => AdminUserDto,
    })
    user: AdminUserDto

    @ApiProperty({
        type: String,
        isArray: true,
    })
    permissions: string[]
}
