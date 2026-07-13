import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

import { PublicSiteSettingsResponseDto } from '../dto/public-site-settings-response.dto'
import { SiteSettingsService } from '../services/site-settings.service'

@Controller('public')
@ApiTags('Public Site Settings')
export class PublicSiteSettingsController {
    constructor(private readonly siteSettingsService: SiteSettingsService) {}

    @Get('site-settings')
    @ApiOperation({ summary: 'Get public site settings' })
    @ApiResponse({ status: 200, type: PublicSiteSettingsResponseDto })
    async getSettings() {
        return this.siteSettingsService.getPublicSettings()
    }
}
