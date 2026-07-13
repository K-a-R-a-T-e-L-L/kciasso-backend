import { ApiProperty } from '@nestjs/swagger'

import { PublicSiteSettingsResponseDto } from './public-site-settings-response.dto'

export class AdminSiteSettingsResponseDto extends PublicSiteSettingsResponseDto {
    @ApiProperty()
    createdAt: Date

    @ApiProperty()
    updatedAt: Date
}
