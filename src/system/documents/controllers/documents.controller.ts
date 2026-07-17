import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Put,
    Query,
    Res,
    StreamableFile,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Response } from 'express'

import { ErrorDto } from '../../../_helpers/errors/error.dto'
import { RequireSectionPermission } from '../../user/decorators/require-section-permission.decorator'
import { UserDecorator } from '../../user/decorators/user.decorator'
import { CreateDocumentDto } from '../dto/create-document.dto'
import { DocumentQueryDto } from '../dto/document-query.dto'
import { DocumentVersionDto } from '../dto/document-version.dto'
import { DocumentDto } from '../dto/document.dto'
import { PaginatedDocumentsDto } from '../dto/paginated-documents.dto'
import { UpdateDocumentPlacementsDto } from '../dto/update-document-placements.dto'
import { UpdateDocumentStatusDto } from '../dto/update-document-status.dto'
import { UpdateDocumentDto } from '../dto/update-document.dto'
import { UploadedFile as DocumentUploadFile, DocumentsService } from '../services/documents.service'
import { documentUploadOptions } from '../storage/document-upload.options'

const multipartDocumentSchema = {
    schema: {
        type: 'object',
        required: ['placementKeys', 'title', 'file'],
        properties: {
            placementKeys: { type: 'array', items: { type: 'string' }, example: ['gia-9.normative-documents'] },
            title: { type: 'string', example: 'Порядок проведения ГИА-9' },
            description: { type: 'string' },
            documentNumber: { type: 'string' },
            documentDate: { type: 'string', format: 'date' },
            file: { type: 'string', format: 'binary' },
        },
    },
}

@Controller('admin/documents')
@ApiTags('Admin Documents')
@ApiBearerAuth()
@RequireSectionPermission('documents')
export class DocumentsController {
    constructor(private readonly documentsService: DocumentsService) {}

    @Post()
    @ApiConsumes('multipart/form-data')
    @ApiBody(multipartDocumentSchema)
    @ApiOperation({ summary: 'Create document with first immutable version' })
    @ApiResponse({ status: 201, type: DocumentDto })
    @ApiResponse({ status: 400, type: ErrorDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    @ApiResponse({ status: 409, type: ErrorDto })
    @UseInterceptors(FileInterceptor('file', documentUploadOptions()))
    async create(
        @Body() dto: CreateDocumentDto,
        @UploadedFile() file: DocumentUploadFile | undefined,
        @UserDecorator() user: { id: number }
    ) {
        return this.documentsService.createDocument(dto, file, user.id)
    }

    @Get()
    @ApiOperation({ summary: 'List document metadata' })
    @ApiResponse({ status: 200, type: PaginatedDocumentsDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    async list(@Query() query: DocumentQueryDto) {
        return this.documentsService.getDocuments(query)
    }

    @Get(':id')
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, type: DocumentDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    async get(@Param('id', ParseIntPipe) id: number) {
        return this.documentsService.getDocument(id)
    }

    @Put(':id/placements')
    @ApiParam({ name: 'id', type: Number })
    @ApiOperation({ summary: 'Replace document placements' })
    @ApiResponse({ status: 200, type: DocumentDto })
    async placements(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDocumentPlacementsDto) {
        return this.documentsService.updatePlacements(id, dto)
    }

    @Delete(':id')
    @HttpCode(204)
    @ApiParam({ name: 'id', type: Number })
    @ApiOperation({ summary: 'Permanently delete document, versions, links and files' })
    async delete(@Param('id', ParseIntPipe) id: number) {
        await this.documentsService.deleteDocument(id)
    }

    @Patch(':id/status')
    @ApiParam({ name: 'id', type: Number })
    @ApiOperation({ summary: 'Change document status' })
    @ApiResponse({ status: 200, type: DocumentDto })
    @ApiResponse({ status: 400, type: ErrorDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    async status(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateDocumentStatusDto,
        @UserDecorator() user: { id: number }
    ) {
        return this.documentsService.updateStatus(id, dto, user.id)
    }

    @Patch(':id')
    @ApiParam({ name: 'id', type: Number })
    @ApiOperation({ summary: 'Update document metadata' })
    @ApiResponse({ status: 200, type: DocumentDto })
    @ApiResponse({ status: 400, type: ErrorDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateDocumentDto,
        @UserDecorator() user: { id: number }
    ) {
        return this.documentsService.updateDocument(id, dto, user.id)
    }

    @Get(':id/versions')
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, type: DocumentVersionDto, isArray: true })
    @ApiResponse({ status: 404, type: ErrorDto })
    async versions(@Param('id', ParseIntPipe) id: number) {
        return this.documentsService.getVersions(id)
    }

    @Post(':id/versions/:versionId/current')
    @HttpCode(200)
    @ApiParam({ name: 'id', type: Number })
    @ApiParam({ name: 'versionId', type: Number })
    @ApiOperation({ summary: 'Make an immutable document version current' })
    @ApiResponse({ status: 200, type: DocumentDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    async makeCurrent(
        @Param('id', ParseIntPipe) id: number,
        @Param('versionId', ParseIntPipe) versionId: number,
        @UserDecorator() user: { id: number }
    ) {
        return this.documentsService.makeCurrent(id, versionId, user.id)
    }

    @Get(':id/versions/:versionId/file')
    @ApiParam({ name: 'id', type: Number })
    @ApiParam({ name: 'versionId', type: Number })
    @ApiOperation({ summary: 'Stream a document version for an authorized admin' })
    @ApiResponse({ status: 200, description: 'Binary document file' })
    @ApiResponse({ status: 404, type: ErrorDto })
    async file(
        @Param('id', ParseIntPipe) id: number,
        @Param('versionId', ParseIntPipe) versionId: number,
        @Res({ passthrough: true }) response: Response
    ) {
        const documentFile = await this.documentsService.getDocumentFile(id, versionId)
        response.setHeader('X-Content-Type-Options', 'nosniff')
        const safeFilename = documentFile.originalFilename.replace(/[\r\n"\\/]/g, '_')
        const encodedFilename = encodeURIComponent(safeFilename)
        return new StreamableFile(documentFile.stream, {
            type: documentFile.mimeType,
            disposition: `attachment; filename="document"; filename*=UTF-8''${encodedFilename}`,
            length: Number(documentFile.sizeBytes),
        })
    }

    @Post(':id/versions')
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } },
    })
    @ApiOperation({ summary: 'Create a new immutable document version' })
    @ApiResponse({ status: 201, type: DocumentDto })
    @ApiResponse({ status: 400, type: ErrorDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    @ApiResponse({ status: 409, type: ErrorDto })
    @UseInterceptors(FileInterceptor('file', documentUploadOptions()))
    async createVersion(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file: DocumentUploadFile | undefined,
        @UserDecorator() user: { id: number }
    ) {
        return this.documentsService.createVersion(id, file, user.id)
    }
}
