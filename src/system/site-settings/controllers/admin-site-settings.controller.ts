import { Body, Controller, Get, Patch } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

import { ErrorDto } from '../../../_helpers/errors/error.dto'
import { RequireSectionPermission } from '../../user/decorators/require-section-permission.decorator'
import { AdminSiteSettingsResponseDto } from '../dto/admin-site-settings-response.dto'
import { UpdateSiteSettingsDto } from '../dto/update-site-settings.dto'
import { SiteSettingsService } from '../services/site-settings.service'

@Controller('admin')
@ApiTags('Admin Site Settings')
export class AdminSiteSettingsController {
    constructor(private readonly siteSettingsService: SiteSettingsService) {}

    @Get('site-settings')
    @RequireSectionPermission('site-settings')
    @ApiOperation({ summary: 'Get site settings for admin' })
    @ApiResponse({ status: 200, type: AdminSiteSettingsResponseDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    async getSettings() {
        return this.siteSettingsService.getAdminSettings()
    }

    @Patch('site-settings')
    @RequireSectionPermission('site-settings')
    @ApiOperation({ summary: 'Update site settings for admin' })
    @ApiResponse({ status: 200, type: AdminSiteSettingsResponseDto })
    @ApiResponse({ status: 400, type: ErrorDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    async updateSettings(@Body() dto: UpdateSiteSettingsDto) {
        return this.siteSettingsService.updateSettings(dto)
    }
}
