import { Body, Controller, Patch, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { User } from '@prisma/client'

import { ErrorDto } from '../../../_helpers/errors/error.dto'
import { UserDecorator } from '../../user/decorators/user.decorator'
import { UserGuard } from '../../user/guards/user.guard'
import { PaginatedDocumentsDto } from '../dto/paginated-documents.dto'
import { ReorderDocumentPlacementsDto } from '../dto/reorder-document-placements.dto'
import { DocumentAccessGuard } from '../policies/document-access.guard'
import { DocumentsService } from '../services/documents.service'

@Controller('admin/document-placements')
@ApiTags('Admin Document Placements')
@ApiBearerAuth()
@UseGuards(UserGuard, DocumentAccessGuard)
export class DocumentPlacementsController {
    constructor(private readonly documentsService: DocumentsService) {}

    @Patch('reorder')
    @ApiOperation({ summary: 'Reorder every document placement in one fixed section' })
    @ApiResponse({ status: 200, type: PaginatedDocumentsDto })
    @ApiResponse({ status: 400, type: ErrorDto })
    async reorder(@Body() dto: ReorderDocumentPlacementsDto, @UserDecorator() user: User) {
        return this.documentsService.reorderPlacements(dto, user)
    }
}
