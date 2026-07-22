import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsDateString, IsIn, IsOptional } from 'class-validator'

export const PUBLICATION_COMMANDS = ['draft', 'publish_now', 'schedule', 'actualize', 'publish_as_of'] as const
export type PublicationCommand = (typeof PUBLICATION_COMMANDS)[number]

export class PublicationCommandDto {
    @ApiProperty({ enum: PUBLICATION_COMMANDS })
    @IsIn(PUBLICATION_COMMANDS)
    command: PublicationCommand

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    publishFrom?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    publishUntil?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    displayPublishedAt?: string
}
