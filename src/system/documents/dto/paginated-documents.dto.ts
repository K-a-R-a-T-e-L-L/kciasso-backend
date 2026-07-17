import { ApiProperty } from '@nestjs/swagger'

import { DocumentDto } from './document.dto'

export class DocumentPaginationMetaDto {
    @ApiProperty() page!: number
    @ApiProperty() limit!: number
    @ApiProperty() total!: number
    @ApiProperty() totalPages!: number
}

export class PaginatedDocumentsDto {
    @ApiProperty({ type: () => DocumentDto, isArray: true }) items!: DocumentDto[]
    @ApiProperty({ type: () => DocumentPaginationMetaDto }) meta!: DocumentPaginationMetaDto
}
