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
})
