import { ApiProperty } from '@nestjs/swagger'

export class AdminNewsCategoryDto {
    @ApiProperty()
    id: number

    @ApiProperty()
    slug: string

    @ApiProperty()
    title: string

    @ApiProperty({ required: false, nullable: true })
    description?: string | null

    @ApiProperty()
    order: number

    @ApiProperty()
    isActive: boolean

    @ApiProperty()
    newsCount: number

    @ApiProperty()
    createdAt: Date

    @ApiProperty()
    updatedAt: Date
}
