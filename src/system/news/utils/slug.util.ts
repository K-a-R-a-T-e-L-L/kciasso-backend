const CYRILLIC_MAP: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'yo',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'kh',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'shch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
}

export function normalizeSlug(value: string): string {
    return value
        .trim()
        .toLocaleLowerCase('ru-RU')
        .split('')
        .map(char => CYRILLIC_MAP[char] ?? char)
        .join('')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
}

export function optionalSlug(value?: string | null): string | undefined {
    const normalized = normalizeSlug(value ?? '')
    return normalized || undefined
}

export function slugCandidate(value: string, fallback?: string): string {
    const normalized = normalizeSlug(value)
    if (normalized) return normalized
    const normalizedFallback = normalizeSlug(fallback ?? '')
    if (normalizedFallback) return normalizedFallback
    throw new Error('SLUG_EMPTY')
}
