import { Body, Controller, Patch } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

import { ErrorDto } from '../../../_helpers/errors/error.dto'
import { RequireSectionPermission } from '../../user/decorators/require-section-permission.decorator'
import { PaginatedDocumentsDto } from '../dto/paginated-documents.dto'
import { ReorderDocumentPlacementsDto } from '../dto/reorder-document-placements.dto'
import { DocumentsService } from '../services/documents.service'

@Controller('admin/document-placements')
@ApiTags('Admin Document Placements')
@ApiBearerAuth()
@RequireSectionPermission('documents')
export class DocumentPlacementsController {
    constructor(private readonly documentsService: DocumentsService) {}

    @Patch('reorder')
    @ApiOperation({ summary: 'Reorder every document placement in one fixed section' })
    @ApiResponse({ status: 200, type: PaginatedDocumentsDto })
    @ApiResponse({ status: 400, type: ErrorDto })
    async reorder(@Body() dto: ReorderDocumentPlacementsDto) {
        return this.documentsService.reorderPlacements(dto)
    }
}
