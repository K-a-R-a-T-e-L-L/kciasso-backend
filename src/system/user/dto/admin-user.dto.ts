import { ApiProperty } from '@nestjs/swagger'

import { AdminAccessDto } from './admin-access.dto'

export class AdminUserDto extends AdminAccessDto {
    @ApiProperty()
    id: number

    @ApiProperty()
    name: string

    @ApiProperty()
    email: string
}
