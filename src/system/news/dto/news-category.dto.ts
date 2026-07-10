import { ApiProperty } from '@nestjs/swagger'

export class NewsCategoryDto {
    @ApiProperty()
    id: number

    @ApiProperty()
    slug: string

    @ApiProperty()
    title: string

    @ApiProperty({ required: false, nullable: true })
    description?: string | null
}
