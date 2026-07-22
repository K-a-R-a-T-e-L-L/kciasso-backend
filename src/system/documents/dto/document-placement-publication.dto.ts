import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsDateString, IsIn, IsOptional } from 'class-validator'

export class DocumentPlacementPublicationDto {
    @ApiProperty({ enum: ['draft', 'publish_now', 'schedule', 'actualize', 'publish_as_of'] })
    @IsIn(['draft', 'publish_now', 'schedule', 'actualize', 'publish_as_of'])
    command: 'draft' | 'publish_now' | 'schedule' | 'actualize' | 'publish_as_of'
    @ApiPropertyOptional() @IsOptional() @IsDateString() publishFrom?: string
    @ApiPropertyOptional() @IsOptional() @IsDateString() publishUntil?: string
    @ApiPropertyOptional() @IsOptional() @IsDateString() displayPublishedAt?: string
}
