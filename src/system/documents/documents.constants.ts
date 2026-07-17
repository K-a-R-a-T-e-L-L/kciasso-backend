export const DOCUMENT_PERMISSION = 'documents'
export type DocumentSectionMetadata = {
    key: string
    group: 'gia-9' | 'gia-11' | 'gia' | 'quality' | 'regional' | 'about'
    groupTitle: string
    title: string
    publicRoute: string
    anchor?: string
    permissionKey: string
}

const section = (
    key: string,
    group: DocumentSectionMetadata['group'],
    groupTitle: string,
    title: string,
    publicRoute: string,
    anchor?: string
): DocumentSectionMetadata => ({
    key,
    group,
    groupTitle,
    title,
    publicRoute,
    ...(anchor ? { anchor } : {}),
    permissionKey: DOCUMENT_PERMISSION,
})

const examSections = (group: 'gia-9' | 'gia-11', groupTitle: string) => [
    section(
        `${group}.normative-documents`,
        group,
        groupTitle,
        'Normative documents',
        `/${group}?section=normative-documents`,
        'docs'
    ),
    section(`${group}.demo`, group, groupTitle, 'Demo materials', `/${group}?section=demo`, 'demo'),
    section(`${group}.deadlines`, group, groupTitle, 'Deadlines', `/${group}?section=deadlines`, 'dates'),
    section(`${group}.results`, group, groupTitle, 'Results', `/${group}?section=results`, 'results'),
    section(`${group}.reports`, group, groupTitle, 'Reports', `/${group}?section=reports`, 'reports'),
    ...(group === 'gia-11'
        ? [
              section('gia-11.essay', group, groupTitle, 'Essay', '/gia-11?section=essay', 'essay'),
              section('gia-11.analytics', group, groupTitle, 'Analytics', '/gia-11?section=analytics', 'analytics'),
          ]
        : []),
]

const giaReference = [
    ['results', 'Exam results'],
    ['ege-appeals', 'EGE appeals'],
    ['oge-appeals', 'OGE appeals'],
    ['final-essay', 'Final essay'],
    ['final-interview', 'Final interview'],
    ['ppe', 'Examination points'],
    ['deadlines', 'GIA deadlines'],
    ['application-gia-11', 'GIA-11 applications'],
    ['application-gia-9', 'GIA-9 applications'],
    ['kege', 'KEGE-2026'],
    ['koge', 'KOGE-2026'],
    ['speaking', 'Speaking'],
    ['foreign-citizens', 'Foreign citizens'],
    ['posters', 'Information posters'],
    ['preparation', 'GIA preparation'],
] as const

const qualitySections = [
    ['rsoko', 'РСОКО'],
    ['rsoko/normativnye-dokumenty', 'РСОКО · Нормативные документы'],
    ['rsoko/regionalnye-kontrolnye-raboty', 'РСОКО · Региональные контрольные работы'],
    ['rsoko/regionalnye-kontrolnye-raboty/demo', 'РСОКО · Демоверсии'],
    ['rsoko/regionalnye-kontrolnye-raboty/sroki', 'РСОКО · Сроки проведения'],
    ['rsoko/regionalnye-kontrolnye-raboty/results', 'РСОКО · Результаты'],
    ['vpr', 'ВПР'],
    ['vpr/normativnye-dokumenty', 'ВПР · Нормативные документы'],
    ['vpr/demo', 'ВПР · Демоверсии'],
    ['vpr/sroki', 'ВПР · Сроки проведения'],
    ['vpr/results', 'ВПР · Результаты'],
    ['niko', 'НИКО'],
    ['niko/normativnye-dokumenty', 'НИКО · Нормативные документы'],
    ['niko/demo', 'НИКО · Демоверсии'],
    ['niko/sroki', 'НИКО · Сроки проведения'],
    ['niko/results', 'НИКО · Результаты'],
    ['proekt-500', 'Проект 500+'],
    ['funkcionalnaya-gramotnost', 'Функциональная грамотность'],
    ['iccs', 'ICCS'],
    ['pirls', 'PIRLS'],
    ['pisa', 'PISA'],
    ['timss', 'TIMSS'],
    ['ocenka-po-modeli-pisa', 'Оценка по модели PISA'],
    ['mehanizmy-upravleniya', 'Механизмы управления качеством образования'],
    ['issledovanie-kompetentsiy-uchiteley', 'Исследование компетенций учителей'],
    ['issledovanie-kompetentsiy-uchiteley/normativnye-dokumenty', 'Компетенции учителей · Нормативные документы'],
    ['issledovanie-kompetentsiy-uchiteley/demo', 'Компетенции учителей · Демоверсии'],
    ['issledovanie-kompetentsiy-uchiteley/sroki', 'Компетенции учителей · Сроки проведения'],
    ['issledovanie-kompetentsiy-uchiteley/results', 'Компетенции учителей · Результаты'],
    ['vpr-spo', 'ВПР СПО'],
    ['vpr-spo/normativnye-dokumenty', 'ВПР СПО · Нормативные документы'],
] as const

export const DOCUMENT_SECTIONS: readonly DocumentSectionMetadata[] = [
    ...examSections('gia-9', 'GIA-9'),
    ...examSections('gia-11', 'GIA-11'),
    ...giaReference.map(([slug, title]) => section(`gia.${slug}`, 'gia', 'Общий раздел ГИА', title, `/gia/${slug}`)),
    ...qualitySections.map(([path, title]) =>
        section(
            `quality.${path.replaceAll('/', '.')}`,
            'quality',
            'Качество образования',
            title,
            `/kachestvo-obrazovaniya/${path}`
        )
    ),
    section(
        'regionalnyy-proekt',
        'regional',
        'Региональный проект',
        'Общие материалы проекта',
        '/regionalnyy-proekt/materialy'
    ),
    section(
        'regionalnyy-proekt.ege',
        'regional',
        'Региональный проект',
        'ЕГЭ: от выбора до зачисления',
        '/regionalnyy-proekt/ege',
        'ege'
    ),
    section(
        'regionalnyy-proekt.vuz',
        'regional',
        'Региональный проект',
        'Вузы Кузбасса',
        '/regionalnyy-proekt/vuz',
        'vuz'
    ),
    section(
        'regionalnyy-proekt.video',
        'regional',
        'Региональный проект',
        'Видеоматериалы вузов',
        '/regionalnyy-proekt/video',
        'video'
    ),
    section('about.ob-uchrezhdenii', 'about', 'О центре', 'Об учреждении', '/o-centre/ob-uchrezhdenii'),
    section(
        'about.protivodeystvie-korruptsii',
        'about',
        'О центре',
        'Противодействие коррупции',
        '/o-centre/protivodeystvie-korruptsii'
    ),
    section('about.soveshchaniya', 'about', 'О центре', 'Совещания', '/o-centre/soveshchaniya'),
    section('about.obuchenie', 'about', 'О центре', 'Обучение', '/o-centre/obuchenie'),
]

const sectionsByKey = new Map(DOCUMENT_SECTIONS.map(section => [section.key, section]))

export function getDocumentSection(key: string): DocumentSectionMetadata | undefined {
    return sectionsByKey.get(key.trim())
}
