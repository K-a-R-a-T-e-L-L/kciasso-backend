import { ApiProperty } from '@nestjs/swagger'
import { HOME_SECTION_KEYS } from '../site-settings.constants'

export class PublicSiteSettingsResponseDto {
    @ApiProperty()
    giaHotlinePhone: string

    @ApiProperty()
    informationPhone: string

    @ApiProperty()
    egeTrustPhone: string

    @ApiProperty()
    email: string

    @ApiProperty({ enum: HOME_SECTION_KEYS, isArray: true })
    homeSectionsOrder: string[]
}
