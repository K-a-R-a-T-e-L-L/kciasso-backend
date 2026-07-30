import { ApiProperty } from '@nestjs/swagger'
import { ArrayUnique, IsArray, IsInt, Min } from 'class-validator'

export class ReorderPageSectionsDto {
    @ApiProperty({ type: [Number] })
    @IsArray()
    @IsInt({ each: true })
    @Min(1, { each: true })
    @ArrayUnique()
    sectionIds: number[]

    @ApiProperty()
    @IsInt()
    @Min(0)
    expectedRevision: number
}
