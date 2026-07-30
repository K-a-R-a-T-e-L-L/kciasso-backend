import { ApiProperty, PartialType } from '@nestjs/swagger'
import { IsInt, Min } from 'class-validator'

import { CreatePageSectionDto } from './create-page-section.dto'
export class UpdatePageSectionDto extends PartialType(CreatePageSectionDto) {
    @ApiProperty() @IsInt() @Min(0) expectedRevision: number
}
