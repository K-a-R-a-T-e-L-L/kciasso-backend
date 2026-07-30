import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsUrl, MaxLength } from 'class-validator'

export class ImportNewsMediaDto {
    @ApiProperty({ format: 'uri' })
    @IsString()
    @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
    @MaxLength(2048)
    url: string
}
