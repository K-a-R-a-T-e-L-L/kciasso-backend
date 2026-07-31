export type PageSystemSection = {
    key: string
    name: string
    systemRendererKey: string
}

export type PageRegistryEntry = {
    pageKey: string
    title: string
    routePattern: string
    systemSections: PageSystemSection[]
    includeGlobalContacts?: boolean
}

const sections = (items: Array<[string, string]>): PageSystemSection[] =>
    items.map(([key, name]) => ({ key, name, systemRendererKey: key }))

// These keys intentionally name existing public route blocks, not speculative
// editor regions. Renderer wiring is Part 2; this registry is the stable
// backend contract used to materialize system definitions.
export const PAGE_REGISTRY: PageRegistryEntry[] = [
    {
        pageKey: 'home',
        title: 'Главная страница',
        routePattern: '/',
        systemSections: sections([
            ['home.hero', 'Первый экран'],
            ['home.carousel', 'Карусель главной страницы'],
            ['home.main-sections', 'Основные разделы'],
            ['home.important-resources', 'Важные ресурсы'],
            ['home.gia', 'Государственная итоговая аттестация'],
            ['home.official-resources', 'Полезные государственные и образовательные ресурсы'],
        ]),
    },
    {
        pageKey: 'news.archive',
        title: 'Архив новостей',
        routePattern: '/news',
        systemSections: sections([['news.archive', 'Архив новостей']]),
    },
    {
        pageKey: 'news.article',
        title: 'Страница новости',
        routePattern: '/news/[slug]',
        systemSections: sections([['news.article', 'Страница новости']]),
    },
    {
        pageKey: 'gia',
        title: 'Государственная итоговая аттестация',
        routePattern: '/gia',
        systemSections: sections([['gia.root', 'Государственная итоговая аттестация']]),
    },
    {
        pageKey: 'gia.9',
        title: 'ГИА-9',
        routePattern: '/gia-9',
        systemSections: sections([
            ['gia-9.hero', 'ГИА-9'],
            ['gia-9.normative-documents', 'Нормативные документы'],
            ['gia-9.demo', 'Демоверсии'],
            ['gia-9.deadlines', 'Сроки проведения'],
            ['gia-9.results', 'Результаты'],
            ['gia-9.reports', 'Отчёты комиссий'],
        ]),
    },
    {
        pageKey: 'gia.11',
        title: 'ГИА-11',
        routePattern: '/gia-11',
        systemSections: sections([
            ['gia-11.hero', 'ГИА-11'],
            ['gia-11.normative-documents', 'Нормативные документы'],
            ['gia-11.demo', 'Демоверсии'],
            ['gia-11.deadlines', 'Сроки проведения'],
            ['gia-11.results', 'Результаты'],
            ['gia-11.reports', 'Отчёты комиссий'],
            ['gia-11.essay', 'Итоговое сочинение'],
            ['gia-11.analytics', 'Аналитические материалы ЕГЭ'],
        ]),
    },
    {
        pageKey: 'quality',
        title: 'Качество образования',
        routePattern: '/kachestvo-obrazovaniya',
        systemSections: sections([['quality.root', 'Качество образования']]),
    },
    {
        pageKey: 'quality.section',
        title: 'Раздел качества образования',
        routePattern: '/kachestvo-obrazovaniya/[...slug]',
        systemSections: sections([['quality.section', 'Раздел качества образования']]),
    },
    {
        pageKey: 'regional-project',
        title: 'Региональный проект',
        routePattern: '/regionalnyy-proekt',
        systemSections: sections([['regional-project.root', 'Региональный проект']]),
    },
    {
        pageKey: 'regional-project.section',
        title: 'Раздел регионального проекта',
        routePattern: '/regionalnyy-proekt/[slug]',
        systemSections: sections([['regional-project.section', 'Раздел регионального проекта']]),
    },
    {
        pageKey: 'about',
        title: 'О центре',
        routePattern: '/o-centre',
        systemSections: sections([['about.root', 'О центре']]),
    },
    {
        pageKey: 'about.contacts',
        title: 'Контакты',
        routePattern: '/o-centre/kontakty',
        systemSections: sections([['about.contacts', 'Контакты центра']]),
        includeGlobalContacts: false,
    },
    {
        pageKey: 'resources',
        title: 'Полезные ресурсы',
        routePattern: '/resources',
        systemSections: sections([['resources.catalog', 'Каталог ресурсов']]),
    },
]

export function getPageRegistryEntry(pageKey: string) {
    return PAGE_REGISTRY.find(item => item.pageKey === pageKey)
}
export function getPageRegistry() {
    return PAGE_REGISTRY
}
