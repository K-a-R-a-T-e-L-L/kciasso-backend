import { ApiProperty } from '@nestjs/swagger'
import { ArrayUnique, IsArray, IsString } from 'class-validator'

export class UpdateUserPermissionsDto {
    @ApiProperty({
        type: String,
        isArray: true,
        example: ['news', 'gia-9.results'],
    })
    @IsArray()
    @ArrayUnique()
    @IsString({ each: true })
    sectionIds: string[]
}
