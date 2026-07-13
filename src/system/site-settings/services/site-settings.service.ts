import { Injectable } from '@nestjs/common'
import { SiteSettings } from '@prisma/client'

import { PrismaService } from '../../../prisma/prisma.service'
import { AdminSiteSettingsResponseDto } from '../dto/admin-site-settings-response.dto'
import { PublicSiteSettingsResponseDto } from '../dto/public-site-settings-response.dto'
import { UpdateSiteSettingsDto } from '../dto/update-site-settings.dto'
import { DEFAULT_SITE_SETTINGS, HOME_SECTION_KEYS, SITE_SETTINGS_SINGLETON_KEY } from '../site-settings.constants'

@Injectable()
export class SiteSettingsService {
    constructor(private readonly prisma: PrismaService) {}

    async getPublicSettings(): Promise<PublicSiteSettingsResponseDto> {
        const settings = await this.getOrCreateSettings()
        return this.toPublicDto(settings)
    }

    async getAdminSettings(): Promise<AdminSiteSettingsResponseDto> {
        const settings = await this.getOrCreateSettings()
        return this.toAdminDto(settings)
    }

    async updateSettings(dto: UpdateSiteSettingsDto): Promise<AdminSiteSettingsResponseDto> {
        const settings = await this.prisma.siteSettings.upsert({
            where: {
                site_key: SITE_SETTINGS_SINGLETON_KEY,
            },
            update: {
                ...(dto.giaHotlinePhone !== undefined ? { gia_hotline_phone: dto.giaHotlinePhone } : {}),
                ...(dto.informationPhone !== undefined ? { information_phone: dto.informationPhone } : {}),
                ...(dto.egeTrustPhone !== undefined ? { ege_trust_phone: dto.egeTrustPhone } : {}),
                ...(dto.email !== undefined ? { email: dto.email } : {}),
                ...(dto.homeSectionsOrder !== undefined ? { home_sections_order: dto.homeSectionsOrder } : {}),
            },
            create: {
                site_key: SITE_SETTINGS_SINGLETON_KEY,
                gia_hotline_phone: dto.giaHotlinePhone ?? DEFAULT_SITE_SETTINGS.giaHotlinePhone,
                information_phone: dto.informationPhone ?? DEFAULT_SITE_SETTINGS.informationPhone,
                ege_trust_phone: dto.egeTrustPhone ?? DEFAULT_SITE_SETTINGS.egeTrustPhone,
                email: dto.email ?? DEFAULT_SITE_SETTINGS.email,
                home_sections_order: dto.homeSectionsOrder ?? [...DEFAULT_SITE_SETTINGS.homeSectionsOrder],
            },
        })

        return this.toAdminDto(settings)
    }

    private async getOrCreateSettings(): Promise<SiteSettings> {
        return this.prisma.siteSettings.upsert({
            where: {
                site_key: SITE_SETTINGS_SINGLETON_KEY,
            },
            update: {},
            create: {
                site_key: SITE_SETTINGS_SINGLETON_KEY,
                gia_hotline_phone: DEFAULT_SITE_SETTINGS.giaHotlinePhone,
                information_phone: DEFAULT_SITE_SETTINGS.informationPhone,
                ege_trust_phone: DEFAULT_SITE_SETTINGS.egeTrustPhone,
                email: DEFAULT_SITE_SETTINGS.email,
                home_sections_order: [...DEFAULT_SITE_SETTINGS.homeSectionsOrder],
            },
        })
    }

    private toPublicDto(settings: SiteSettings): PublicSiteSettingsResponseDto {
        return {
            giaHotlinePhone: settings.gia_hotline_phone,
            informationPhone: settings.information_phone,
            egeTrustPhone: settings.ege_trust_phone,
            email: settings.email,
            homeSectionsOrder: this.normalizeHomeSectionsOrder(settings.home_sections_order),
        }
    }

    private toAdminDto(settings: SiteSettings): AdminSiteSettingsResponseDto {
        return {
            ...this.toPublicDto(settings),
            createdAt: settings.created_at,
            updatedAt: settings.updated_at,
        }
    }

    private normalizeHomeSectionsOrder(value: string[]): string[] {
        const allowed = new Set<string>(HOME_SECTION_KEYS)
        const seen = new Set<string>()
        const normalized = value.filter(key => allowed.has(key) && !seen.has(key) && seen.add(key))

        for (const key of HOME_SECTION_KEYS) {
            if (!seen.has(key)) normalized.push(key)
        }

        return normalized
    }
}
