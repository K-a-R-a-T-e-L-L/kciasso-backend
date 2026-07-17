import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsDateString, IsOptional } from 'class-validator'

export class CreateDocumentShareLinkDto {
    @ApiPropertyOptional({ nullable: true, example: '2026-08-01T12:00:00.000Z' })
    @IsOptional()
    @IsDateString()
    expiresAt?: string | null
}
