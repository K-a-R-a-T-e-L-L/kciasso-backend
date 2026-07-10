import { ApiProperty } from '@nestjs/swagger'

export class NewsPaginationMetaDto {
    @ApiProperty()
    page: number

    @ApiProperty()
    limit: number

    @ApiProperty()
    total: number

    @ApiProperty()
    totalPages: number
}
