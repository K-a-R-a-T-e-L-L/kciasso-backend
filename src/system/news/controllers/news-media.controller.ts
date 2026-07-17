import {
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Post,
    Res,
    StreamableFile,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Response } from 'express'
import { memoryStorage } from 'multer'

import { RequireAdminCapability } from '../../user/decorators/require-admin-capability.decorator'
import { NewsMediaUploadDto } from '../dto/news-media-upload.dto'
import { NEWS_IMAGE_MAX_BYTES, NewsImageFile } from '../media/news-media.policy'
import { NewsMediaService } from '../media/news-media.service'

@Controller('admin/news/media')
@ApiTags('Admin News Media')
@RequireAdminCapability('news')
export class AdminNewsMediaController {
    constructor(private readonly media: NewsMediaService) {}

    @Post()
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } },
    })
    @ApiResponse({ status: 201, type: NewsMediaUploadDto })
    @UseInterceptors(
        FileInterceptor('file', { storage: memoryStorage(), limits: { files: 1, fileSize: NEWS_IMAGE_MAX_BYTES } })
    )
    upload(@UploadedFile() file: NewsImageFile) {
        return this.media.store(file)
    }

    @Delete(':key')
    @HttpCode(204)
    async removeUnreferenced(@Param('key') key: string) {
        await this.media.deleteIfUnreferenced(key)
    }
}

@Controller('public/news/media')
@ApiTags('Public News Media')
export class PublicNewsMediaController {
    constructor(private readonly media: NewsMediaService) {}

    @Get(':key')
    @ApiOperation({ summary: 'Stream an owned news image' })
    @ApiResponse({ status: 200, description: 'JPEG, PNG, or WebP image' })
    async get(@Param('key') key: string, @Res({ passthrough: true }) response: Response) {
        const file = await this.media.open(key)
        response.setHeader('X-Content-Type-Options', 'nosniff')
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        return new StreamableFile(file.stream, { type: file.mimeType, length: file.size })
    }
}
