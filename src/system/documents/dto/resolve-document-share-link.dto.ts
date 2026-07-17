import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength, MinLength } from 'class-validator'

export class ResolveDocumentShareLinkDto {
    @ApiProperty({ minLength: 32, maxLength: 128 })
    @IsString()
    @MinLength(32)
    @MaxLength(128)
    token!: string
}
