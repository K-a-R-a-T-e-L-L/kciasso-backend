import { ApiProperty } from '@nestjs/swagger'
import { IsIn } from 'class-validator'

export type PublicDocumentStatus = 'DRAFT' | 'PUBLISHED'

export class UpdateDocumentStatusDto {
    @ApiProperty({ enum: ['DRAFT', 'PUBLISHED'] })
    @IsIn(['DRAFT', 'PUBLISHED'])
    status!: PublicDocumentStatus
}
