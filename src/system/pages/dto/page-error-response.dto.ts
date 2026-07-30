import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class PageErrorResponseDto {
    @ApiProperty()
    statusCode: number

    @ApiProperty()
    message: string

    @ApiPropertyOptional()
    error?: string

    @ApiPropertyOptional({ type: [String] })
    missingPageKeys?: string[]
}
