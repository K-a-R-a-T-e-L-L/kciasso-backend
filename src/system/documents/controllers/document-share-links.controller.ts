import {
    Body,
    Controller,
    Get,
    HttpCode,
    Param,
    ParseIntPipe,
    Post,
    Res,
    StreamableFile,
    UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger'
import { User } from '@prisma/client'
import { Response } from 'express'

import { ErrorDto } from '../../../_helpers/errors/error.dto'
import { UserDecorator } from '../../user/decorators/user.decorator'
import { UserGuard } from '../../user/guards/user.guard'
import { CreateDocumentShareLinkDto } from '../dto/create-document-share-link.dto'
import { CreatedDocumentShareLinkDto } from '../dto/created-document-share-link.dto'
import { DocumentShareLinkDto } from '../dto/document-share-link.dto'
import { ResolveDocumentShareLinkDto } from '../dto/resolve-document-share-link.dto'
import { DocumentAccessGuard } from '../policies/document-access.guard'
import { DocumentShareLinksService } from '../services/document-share-links.service'

@Controller('admin/document-versions')
@ApiTags('Admin Document Share Links')
@ApiBearerAuth()
@UseGuards(UserGuard, DocumentAccessGuard)
export class AdminDocumentShareLinksController {
    constructor(private readonly shareLinks: DocumentShareLinksService) {}

    @Post(':versionId/share-links')
    @ApiParam({ name: 'versionId', type: Number })
    @ApiBody({ type: CreateDocumentShareLinkDto })
    @ApiOperation({ summary: 'Create a one-time secret share token for an immutable version' })
    @ApiResponse({ status: 201, type: CreatedDocumentShareLinkDto })
    @ApiResponse({ status: 400, type: ErrorDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    async create(
        @Param('versionId', ParseIntPipe) versionId: number,
        @Body() dto: CreateDocumentShareLinkDto,
        @UserDecorator() user: User
    ) {
        return this.shareLinks.create(versionId, dto, user)
    }

    @Get(':versionId/share-links')
    @ApiParam({ name: 'versionId', type: Number })
    @ApiOperation({ summary: 'List share links without raw tokens' })
    @ApiResponse({ status: 200, type: DocumentShareLinkDto, isArray: true })
    @ApiResponse({ status: 403, type: ErrorDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    async list(@Param('versionId', ParseIntPipe) versionId: number, @UserDecorator() user: User) {
        return this.shareLinks.list(versionId, user)
    }
}

@Controller('admin/document-share-links')
@ApiTags('Admin Document Share Links')
@ApiBearerAuth()
@UseGuards(UserGuard, DocumentAccessGuard)
export class AdminDocumentShareLinkRevokeController {
    constructor(private readonly shareLinks: DocumentShareLinksService) {}

    @Post(':id/revoke')
    @HttpCode(200)
    @ApiParam({ name: 'id', type: Number })
    @ApiOperation({ summary: 'Revoke a secret share link' })
    @ApiResponse({ status: 200, type: DocumentShareLinkDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    async revoke(@Param('id', ParseIntPipe) id: number, @UserDecorator() user: User) {
        return this.shareLinks.revoke(id, user)
    }
}

@Controller('public/document-share-links')
@ApiTags('Public Document Share Links')
export class PublicDocumentShareLinksController {
    constructor(private readonly shareLinks: DocumentShareLinksService) {}

    @Post('resolve')
    @HttpCode(200)
    @ApiBody({ type: ResolveDocumentShareLinkDto })
    @ApiOperation({ summary: 'Resolve a secret token into the exact immutable document version bytes' })
    @ApiProduces('application/octet-stream')
    @ApiResponse({ status: 200, description: 'Binary document version file' })
    @ApiResponse({ status: 400, type: ErrorDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    async resolve(@Body() dto: ResolveDocumentShareLinkDto, @Res({ passthrough: true }) response: Response) {
        const file = await this.shareLinks.resolve(dto)
        response.setHeader('Cache-Control', 'private, no-store')
        response.setHeader('Pragma', 'no-cache')
        response.setHeader('Referrer-Policy', 'no-referrer')
        response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
        response.setHeader('X-Content-Type-Options', 'nosniff')
        return new StreamableFile(file.stream, {
            type: file.mimeType,
            disposition: file.disposition,
            length: Number(file.sizeBytes),
        })
    }
}
