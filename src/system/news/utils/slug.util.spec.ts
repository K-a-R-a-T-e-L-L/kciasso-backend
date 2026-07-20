import { normalizeSlug, optionalSlug, slugCandidate } from './slug.util'

describe('news slug utility', () => {
    it('transliterates Cyrillic and normalizes separators', () => {
        expect(normalizeSlug('Качество образования')).toBe('kachestvo-obrazovaniya')
        expect(normalizeSlug('Результаты ЕГЭ 2026')).toBe('rezultaty-ege-2026')
        expect(normalizeSlug(' Ёлка -- 2026!! ')).toBe('yolka-2026')
    })

    it('returns undefined for an empty optional slug and throws for an empty candidate', () => {
        expect(optionalSlug('   ')).toBeUndefined()
        expect(() => slugCandidate('***')).toThrow('SLUG_EMPTY')
    })
})
