export const SITE_SETTINGS_SINGLETON_KEY = 'default'

const HOME_SECTION_KEYS = [
    'home.quick-access',
    'home.resources',
    'home.gia-reference',
    'home.official-resources',
] as const

// Seed runtime is intentionally self-contained because the production image
// includes prisma/** but not src/**. Keep these defaults aligned with the app.
export const DEFAULT_SITE_SETTINGS = {
    giaHotlinePhone: '8 (3842) 587025',
    informationPhone: '8 (495) 198-92-38',
    egeTrustPhone: '8 (495) 198-93-38',
    email: 'info@kcias.ru',
    homeSectionsOrder: [...HOME_SECTION_KEYS],
} as const
