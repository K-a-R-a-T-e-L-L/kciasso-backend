import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Req,
    applyDecorators,
} from '@nestjs/common'
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiConflictResponse,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger'

import { CreatePageSectionDto } from './dto/create-page-section.dto'
import {
    CreateGlobalHtmlSectionResponseDto,
    DeleteGlobalHtmlSectionResponseDto,
    GlobalHtmlSectionResponseDto,
} from './dto/global-html-section-response.dto'
import { CreateGlobalHtmlSectionDto, UpdateGlobalHtmlSectionDto } from './dto/global-html-section.dto'
import { PageErrorResponseDto } from './dto/page-error-response.dto'
import { AdminPageLayoutResponseDto, PublicPageLayoutResponseDto } from './dto/page-layout-response.dto'
import { PageRegistrySummaryDto } from './dto/page-registry-summary.dto'
import { DeleteGlobalHtmlSectionDto, DeletePageSectionDto, TogglePageSectionDto } from './dto/page-section-mutation.dto'
import { ReorderPageSectionsDto } from './dto/reorder-page-sections.dto'
import { UpdatePageSectionDto } from './dto/update-page-section.dto'
import { PagesService } from './pages.service'
import { RequireAdminCapability } from '../user/decorators/require-admin-capability.decorator'

const pageReadErrors = () =>
    applyDecorators(
        ApiForbiddenResponse({ type: PageErrorResponseDto }),
        ApiNotFoundResponse({ type: PageErrorResponseDto })
    )
const pageMutationErrors = () =>
    applyDecorators(
        ApiBadRequestResponse({ type: PageErrorResponseDto }),
        ApiForbiddenResponse({ type: PageErrorResponseDto }),
        ApiNotFoundResponse({ type: PageErrorResponseDto }),
        ApiConflictResponse({ type: PageErrorResponseDto })
    )
const globalMutationErrors = () =>
    applyDecorators(
        ApiForbiddenResponse({ type: PageErrorResponseDto }),
        ApiNotFoundResponse({ type: PageErrorResponseDto }),
        ApiConflictResponse({ type: PageErrorResponseDto })
    )

@ApiTags('Page Layouts')
@Controller()
export class PagesController {
    constructor(private readonly pages: PagesService) {}
    @Get('public/pages/:pageKey/layout')
    @ApiOperation({ summary: 'Get visible public page placements' })
    @ApiOkResponse({ type: PublicPageLayoutResponseDto })
    @ApiNotFoundResponse({ type: PageErrorResponseDto, description: 'PAGE_NOT_FOUND' })
    getPublic(@Param('pageKey') key: string): Promise<PublicPageLayoutResponseDto> {
        return this.pages.getPublic(key)
    }
    @Get('admin/pages/registry')
    @RequireAdminCapability('site-settings')
    @ApiBearerAuth()
    @ApiOkResponse({ type: PageRegistrySummaryDto, isArray: true })
    @ApiForbiddenResponse({ type: PageErrorResponseDto })
    registry(): Promise<PageRegistrySummaryDto[]> {
        return this.pages.listRegistry()
    }
    @Get('admin/pages/:pageKey/layout')
    @RequireAdminCapability('site-settings')
    @ApiBearerAuth()
    @ApiOkResponse({ type: AdminPageLayoutResponseDto })
    @pageReadErrors()
    layout(@Param('pageKey') key: string, @Req() r: any): Promise<AdminPageLayoutResponseDto> {
        return this.pages.getAdmin(key, r.user?.is_super_admin === true)
    }
    @Post('admin/pages/:pageKey/sections')
    @RequireAdminCapability('site-settings')
    @ApiBearerAuth()
    @ApiCreatedResponse({ type: AdminPageLayoutResponseDto })
    @pageMutationErrors()
    create(
        @Param('pageKey') key: string,
        @Body() dto: CreatePageSectionDto,
        @Req() r: any
    ): Promise<AdminPageLayoutResponseDto> {
        this.super(r)
        return this.pages.createPageCustom(key, dto)
    }
    @Patch('admin/pages/:pageKey/sections/:placementId')
    @RequireAdminCapability('site-settings')
    @ApiBearerAuth()
    @ApiOkResponse({ type: AdminPageLayoutResponseDto })
    @pageMutationErrors()
    update(
        @Param('pageKey') key: string,
        @Param('placementId') id: string,
        @Body() dto: UpdatePageSectionDto,
        @Req() r: any
    ): Promise<AdminPageLayoutResponseDto> {
        this.super(r)
        return this.pages.updatePageCustom(key, Number(id), dto)
    }
    @Delete('admin/pages/:pageKey/sections/:placementId')
    @RequireAdminCapability('site-settings')
    @ApiBearerAuth()
    @ApiOkResponse({ type: AdminPageLayoutResponseDto })
    @pageMutationErrors()
    remove(
        @Param('pageKey') key: string,
        @Param('placementId') id: string,
        @Body() body: DeletePageSectionDto,
        @Req() r: any
    ): Promise<AdminPageLayoutResponseDto> {
        this.super(r)
        return this.pages.deletePageCustom(key, Number(id), body.expectedRevision)
    }
    @Post('admin/pages/:pageKey/sections/:placementId/toggle')
    @RequireAdminCapability('site-settings')
    @ApiBearerAuth()
    @ApiOkResponse({ type: AdminPageLayoutResponseDto })
    @pageMutationErrors()
    @HttpCode(HttpStatus.OK)
    toggle(
        @Param('pageKey') key: string,
        @Param('placementId') id: string,
        @Body() body: TogglePageSectionDto
    ): Promise<AdminPageLayoutResponseDto> {
        return this.pages.toggle(key, Number(id), body.isVisible, body.expectedRevision)
    }
    @Post('admin/pages/:pageKey/sections/reorder')
    @RequireAdminCapability('site-settings')
    @ApiBearerAuth()
    @ApiOkResponse({ type: AdminPageLayoutResponseDto })
    @pageMutationErrors()
    @HttpCode(HttpStatus.OK)
    reorder(@Param('pageKey') key: string, @Body() dto: ReorderPageSectionsDto): Promise<AdminPageLayoutResponseDto> {
        return this.pages.reorder(key, dto)
    }
    @Get('admin/pages/global-sections')
    @RequireAdminCapability('site-settings')
    @ApiBearerAuth()
    @ApiOkResponse({ type: GlobalHtmlSectionResponseDto, isArray: true })
    @ApiForbiddenResponse({ type: PageErrorResponseDto })
    globals(@Req() r: any): Promise<GlobalHtmlSectionResponseDto[]> {
        return this.pages.listGlobalSections(r.user?.is_super_admin === true)
    }
    @Post('admin/pages/global-sections')
    @RequireAdminCapability('site-settings')
    @ApiBearerAuth()
    @ApiCreatedResponse({ type: CreateGlobalHtmlSectionResponseDto })
    @globalMutationErrors()
    createGlobal(@Body() dto: CreateGlobalHtmlSectionDto, @Req() r: any): Promise<CreateGlobalHtmlSectionResponseDto> {
        this.super(r)
        return this.pages.createGlobalCustom(dto)
    }
    @Get('admin/pages/global-sections/:definitionId')
    @RequireAdminCapability('site-settings')
    @ApiBearerAuth()
    @ApiOkResponse({ type: GlobalHtmlSectionResponseDto })
    @pageReadErrors()
    global(@Param('definitionId') id: string, @Req() r: any): Promise<GlobalHtmlSectionResponseDto> {
        return this.pages.getGlobal(Number(id), r.user?.is_super_admin === true)
    }
    @Patch('admin/pages/global-sections/:definitionId')
    @RequireAdminCapability('site-settings')
    @ApiBearerAuth()
    @ApiOkResponse({ type: GlobalHtmlSectionResponseDto })
    @globalMutationErrors()
    updateGlobal(
        @Param('definitionId') id: string,
        @Body() dto: UpdateGlobalHtmlSectionDto,
        @Req() r: any
    ): Promise<GlobalHtmlSectionResponseDto> {
        this.super(r)
        return this.pages.updateGlobalCustom(Number(id), dto)
    }
    @Delete('admin/pages/global-sections/:definitionId')
    @RequireAdminCapability('site-settings')
    @ApiBearerAuth()
    @ApiOkResponse({ type: DeleteGlobalHtmlSectionResponseDto })
    @globalMutationErrors()
    deleteGlobal(
        @Param('definitionId') id: string,
        @Body() body: DeleteGlobalHtmlSectionDto,
        @Req() r: any
    ): Promise<DeleteGlobalHtmlSectionResponseDto> {
        this.super(r)
        return this.pages.deleteGlobalCustom(Number(id), body.expectedDefinitionRevision)
    }
    private super(r: any) {
        if (r.user?.is_super_admin !== true) throw new ForbiddenException('Super admin access is required')
    }
}
