import { BadRequestException, Controller, Get, Param, Query, Res, StreamableFile } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiProduces, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Response } from 'express'

import { ErrorCodeEnum } from '../../../_helpers/enums/validator/error.code.enum'
import { ErrorDto } from '../../../_helpers/errors/error.dto'
import { getDocumentSection } from '../documents.constants'
import { PublicDocumentDto } from '../dto/public-document.dto'
import { DocumentsService } from '../services/documents.service'

@Controller('public/documents')
@ApiTags('Public Documents')
export class PublicDocumentsController {
    constructor(private readonly documents: DocumentsService) {}

    @Get()
    @ApiQuery({ name: 'sectionKey', required: true, example: 'gia-9.normative-documents' })
    @ApiOperation({ summary: 'List published documents for a fixed public section' })
    @ApiResponse({ status: 200, type: PublicDocumentDto, isArray: true })
    @ApiResponse({ status: 400, type: ErrorDto })
    list(@Query('sectionKey') sectionKey: string) {
        if (!sectionKey || !getDocumentSection(sectionKey)) {
            throw new BadRequestException(
                new ErrorDto(ErrorCodeEnum.DOCUMENT_SECTION_NOT_FOUND, 'Bad Request', 400, 'Unknown document section')
            )
        }
        return this.documents.getPublicDocuments(sectionKey)
    }

    @Get(':id/file')
    @ApiParam({ name: 'id', type: Number })
    @ApiProduces('application/octet-stream')
    @ApiOperation({ summary: 'Stream the current published document file' })
    @ApiResponse({ status: 200, description: 'Binary published document file' })
    @ApiResponse({ status: 404, type: ErrorDto })
    async file(@Param('id') idValue: string, @Res({ passthrough: true }) response: Response) {
        const id = /^\d+$/.test(idValue) ? Number(idValue) : Number.NaN
        const file = await this.documents.getPublicDocumentFile(id)
        response.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
        response.setHeader('Referrer-Policy', 'no-referrer')
        response.setHeader('X-Robots-Tag', 'noindex')
        response.setHeader('X-Content-Type-Options', 'nosniff')
        return new StreamableFile(file.stream, {
            type: file.mimeType,
            disposition: file.disposition,
            length: Number(file.sizeBytes),
        })
    }
}
