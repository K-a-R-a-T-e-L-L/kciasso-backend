export const SITE_SETTINGS_SINGLETON_KEY = 'default'

export const HOME_SECTION_KEYS = [
    'home.quick-access',
    'home.resources',
    'home.gia-reference',
    'home.official-resources',
] as const

export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number]

export const DEFAULT_SITE_SETTINGS = {
    giaHotlinePhone: '8 (3842) 587025',
    informationPhone: '8 (495) 198-92-38',
    egeTrustPhone: '8 (495) 198-93-38',
    email: 'info@kcias.ru',
    homeSectionsOrder: [...HOME_SECTION_KEYS],
} as const
