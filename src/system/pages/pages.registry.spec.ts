import { getPageRegistry, getPageRegistryEntry } from './pages.registry'

describe('page registry', () => {
    it('contains every required template', () => {
        for (const key of [
            'home',
            'news.archive',
            'news.article',
            'gia',
            'gia.9',
            'gia.11',
            'quality',
            'quality.section',
            'regional-project',
            'regional-project.section',
            'about',
            'about.contacts',
            'resources',
        ])
            expect(getPageRegistryEntry(key)).toBeDefined()
    })
    it('does not duplicate system keys within a page', () => {
        for (const page of getPageRegistry())
            expect(new Set(page.systemSections.map(item => item.key)).size).toBe(page.systemSections.length)
    })
    it('keeps global contacts on about root but excludes them from the full contacts page', () => {
        expect(getPageRegistryEntry('about')?.includeGlobalContacts).not.toBe(false)
        expect(getPageRegistryEntry('about.contacts')?.includeGlobalContacts).toBe(false)
    })
    it('models GIA-11 essay and analytics independently without the obsolete additional renderer', () => {
        const keys = getPageRegistryEntry('gia.11')?.systemSections.map(section => section.key)
        expect(keys).toEqual([
            'gia-11.hero',
            'gia-11.normative-documents',
            'gia-11.demo',
            'gia-11.deadlines',
            'gia-11.results',
            'gia-11.reports',
            'gia-11.essay',
            'gia-11.analytics',
        ])
        expect(keys).not.toContain('gia-11.additional')
    })
})
