import { ApiProperty } from '@nestjs/swagger'

export class NewsMediaUploadDto {
    @ApiProperty()
    key: string

    @ApiProperty()
    url: string
}
