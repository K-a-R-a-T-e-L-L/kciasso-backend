import { ApiProperty } from '@nestjs/swagger'

export class AdminSectionDto {
    @ApiProperty()
    id: number

    @ApiProperty()
    sectionId: string

    @ApiProperty()
    title: string

    @ApiProperty()
    kind: string

    @ApiProperty({ required: false, nullable: true })
    route?: string | null

    @ApiProperty({ required: false, nullable: true })
    parentId?: number | null

    @ApiProperty()
    order: number

    @ApiProperty()
    isEditable: boolean
}
