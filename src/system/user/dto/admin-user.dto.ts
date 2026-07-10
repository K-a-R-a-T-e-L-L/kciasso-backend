import { ApiProperty } from '@nestjs/swagger'

export class AdminUserDto {
    @ApiProperty()
    id: number

    @ApiProperty()
    name: string

    @ApiProperty()
    email: string

    @ApiProperty()
    isSuperAdmin: boolean

    @ApiProperty({
        type: String,
        isArray: true,
    })
    permissions: string[]
}
