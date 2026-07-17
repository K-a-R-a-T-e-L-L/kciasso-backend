import { ApiProperty } from '@nestjs/swagger'

import { DocumentShareLinkDto } from './document-share-link.dto'

export class CreatedDocumentShareLinkDto extends DocumentShareLinkDto {
    @ApiProperty({ description: 'Returned only by the create operation' })
    token!: string

    @ApiProperty({ example: '/share/document#<token>' })
    sharePath!: string
}
