import { PrismaClient } from '@prisma/client'
import * as bcryptjs from 'bcryptjs'
import {
    DEFAULT_SITE_SETTINGS,
    SITE_SETTINGS_SINGLETON_KEY,
} from '../src/system/site-settings/site-settings.constants'

const saltRounds = 10

export const sections = [
    { section_id: 'home.hero', title: 'Home hero', kind: 'block', route: '/' },
    { section_id: 'home.quick-access', title: 'Home quick access', kind: 'block', route: '/' },
    { section_id: 'home.resources', title: 'Home resources', kind: 'block', route: '/' },
    { section_id: 'home.news-preview', title: 'Home news preview', kind: 'block', route: '/' },
    { section_id: 'home.contacts', title: 'Home contacts', kind: 'block', route: '/' },
    { section_id: 'news', title: 'News', kind: 'page', route: '/news' },
    { section_id: 'news.article', title: 'News article', kind: 'page', route: '/news/[slug]', parentSectionId: 'news' },
    { section_id: 'gia', title: 'GIA', kind: 'page', route: '/gia' },
    { section_id: 'gia-9', title: 'GIA-9', kind: 'page', route: '/gia-9', parentSectionId: 'gia' },
    {
        section_id: 'gia-9.normative-documents',
        title: 'GIA-9 normative documents',
        kind: 'tab',
        route: '/gia-9#normative-documents',
        parentSectionId: 'gia-9',
    },
    { section_id: 'gia-9.demo', title: 'GIA-9 demo', kind: 'tab', route: '/gia-9#demo', parentSectionId: 'gia-9' },
    {
        section_id: 'gia-9.deadlines',
        title: 'GIA-9 deadlines',
        kind: 'tab',
        route: '/gia-9#deadlines',
        parentSectionId: 'gia-9',
    },
    { section_id: 'gia-9.results', title: 'GIA-9 results', kind: 'tab', route: '/gia-9#results', parentSectionId: 'gia-9' },
    { section_id: 'gia-9.reports', title: 'GIA-9 reports', kind: 'tab', route: '/gia-9#reports', parentSectionId: 'gia-9' },
    { section_id: 'gia-11', title: 'GIA-11', kind: 'page', route: '/gia-11', parentSectionId: 'gia' },
    {
        section_id: 'gia-11.normative-documents',
        title: 'GIA-11 normative documents',
        kind: 'tab',
        route: '/gia-11#normative-documents',
        parentSectionId: 'gia-11',
    },
    { section_id: 'gia-11.demo', title: 'GIA-11 demo', kind: 'tab', route: '/gia-11#demo', parentSectionId: 'gia-11' },
    {
        section_id: 'gia-11.deadlines',
        title: 'GIA-11 deadlines',
        kind: 'tab',
        route: '/gia-11#deadlines',
        parentSectionId: 'gia-11',
    },
    { section_id: 'gia-11.results', title: 'GIA-11 results', kind: 'tab', route: '/gia-11#results', parentSectionId: 'gia-11' },
    { section_id: 'gia-11.reports', title: 'GIA-11 reports', kind: 'tab', route: '/gia-11#reports', parentSectionId: 'gia-11' },
    {
        section_id: 'gia-11.essay',
        title: 'GIA-11 final essay',
        kind: 'tab',
        route: '/gia-11#final-essay',
        parentSectionId: 'gia-11',
    },
    {
        section_id: 'gia-11.analytics',
        title: 'GIA-11 analytics',
        kind: 'tab',
        route: '/gia-11#analytics',
        parentSectionId: 'gia-11',
    },
    {
        section_id: 'regional-project.ege',
        title: 'Regional project EGE',
        kind: 'page',
        route: '/regionalnyy-proekt#ege',
    },
    {
        section_id: 'regional-project.vuz',
        title: 'Regional project universities',
        kind: 'page',
        route: '/regionalnyy-proekt#vuz',
    },
    {
        section_id: 'regional-project.video',
        title: 'Regional project videos',
        kind: 'page',
        route: '/regionalnyy-proekt#video',
    },
    { section_id: 'kachestvo.root', title: 'Education quality', kind: 'page', route: '/kachestvo-obrazovaniya' },
    { section_id: 'about.contacts', title: 'About contacts', kind: 'page', route: '/o-centre/kontakty' },
    { section_id: 'resources.catalog', title: 'Resources catalog', kind: 'page', route: '/resursy' },
    { section_id: 'site-settings', title: 'Настройки сайта', kind: 'settings', route: '/admin/settings' },
] as const

export const newsCategories = [
    {
        slug: 'gia',
        title: 'ГИА',
        description: 'Новости о государственной итоговой аттестации.',
        order: 0,
        is_active: true,
    },
    {
        slug: 'quality',
        title: 'Качество образования',
        description: 'Новости об оценочных процедурах и исследованиях.',
        order: 1,
        is_active: true,
    },
    {
        slug: 'center',
        title: 'О центре',
        description: 'Новости о деятельности учреждения.',
        order: 2,
        is_active: true,
    },
    {
        slug: 'events',
        title: 'События',
        description: 'Анонсы и материалы мероприятий.',
        order: 3,
        is_active: true,
    },
] as const

export const newsSeedItems = [
    {
        slug: 'rezultaty-ege-po-russkomu-yazyku',
        title: 'В Кузбассе утверждены результаты ЕГЭ по русскому языку',
        excerpt: 'Опубликованы результаты экзамена и сроки подачи апелляций.',
        content:
            'В регионе утверждены результаты ЕГЭ по русскому языку. Участники могут ознакомиться с ними в установленные сроки, а также подать апелляцию в порядке, предусмотренном регламентом государственной итоговой аттестации.',
        categorySlug: 'gia',
        cover_image_url: 'https://example.com/news/russian-language.jpg',
        is_published: true,
        published_at: '2026-06-28T09:00:00.000Z',
    },
    {
        slug: 'apellyatsii-ege-po-biologii-geografii-i-informatike',
        title: '3 июля 2026 года состоится рассмотрение апелляций участников ЕГЭ',
        excerpt: 'Рассмотрение апелляций пройдёт в очном и дистанционном форматах.',
        content:
            'Для участников ЕГЭ по биологии, географии и информатике организовано рассмотрение апелляций. Формат участия определяется графиком работы конфликтной комиссии и индивидуальным временем, назначенным каждому участнику.',
        categorySlug: 'gia',
        cover_image_url: 'https://example.com/news/appeals.jpg',
        is_published: true,
        published_at: '2026-07-01T09:30:00.000Z',
    },
    {
        slug: 'materialy-gia-po-razdelam',
        title: 'Материалы государственной итоговой аттестации собраны по разделам',
        excerpt: 'Навигация по основным материалам ГИА стала удобнее для пользователей.',
        content:
            'В новой структуре раздела собраны нормативные документы, демоверсии, сроки проведения и аналитические материалы. Это помогает быстрее находить нужную информацию участникам экзаменов и специалистам образовательных организаций.',
        categorySlug: 'center',
        cover_image_url: 'https://example.com/news/materials.jpg',
        is_published: true,
        published_at: '2026-07-02T08:00:00.000Z',
    },
    {
        slug: 'issledovaniya-kachestva-obrazovaniya',
        title: 'Раздел качества образования пополнен новыми материалами',
        excerpt: 'Опубликованы обновлённые материалы по исследованиям и оценочным процедурам.',
        content:
            'В разделе качества образования размещены новые материалы по международным исследованиям, региональным оценочным процедурам и сопровождению образовательных организаций. Материалы доступны в структурированном виде по направлениям.',
        categorySlug: 'quality',
        cover_image_url: 'https://example.com/news/quality.jpg',
        is_published: true,
        published_at: '2026-07-03T10:15:00.000Z',
    },
    {
        slug: 'seminar-dlya-spetsialistov',
        title: 'В центре состоится семинар для специалистов муниципальных команд',
        excerpt: 'Запланирован методический семинар по вопросам оценки качества образования.',
        content:
            'Центр проводит методический семинар для специалистов муниципальных команд. В программе обсуждение организационных вопросов, сопровождения процедур оценки и обмен практиками между территориями.',
        categorySlug: 'events',
        cover_image_url: 'https://example.com/news/seminar.jpg',
        is_published: false,
        published_at: null,
    },
] as const

export type SuperAdminSeedInput = {
    email?: string
    password?: string
}

export async function hashPassword(password: string) {
    return bcryptjs.hash(password, saltRounds)
}

export async function seedSections(prisma: PrismaClient) {
    for (const [index, section] of sections.entries()) {
        await prisma.section.upsert({
            where: { section_id: section.section_id },
            update: {
                title: section.title,
                kind: section.kind,
                route: section.route,
                sort_order: index,
            },
            create: {
                section_id: section.section_id,
                title: section.title,
                kind: section.kind,
                route: section.route,
                sort_order: index,
            },
        })
    }

    for (const section of sections) {
        if (!('parentSectionId' in section) || !section.parentSectionId) {
            continue
        }

        const parent = await prisma.section.findUnique({
            where: { section_id: section.parentSectionId },
            select: { id: true },
        })

        if (!parent) {
            continue
        }

        await prisma.section.update({
            where: { section_id: section.section_id },
            data: { parent_id: parent.id },
        })
    }
}

export async function seedNewsCategories(prisma: PrismaClient) {
    for (const category of newsCategories) {
        await prisma.newsCategory.upsert({
            where: {
                slug: category.slug,
            },
            update: {
                title: category.title,
                description: category.description,
                order: category.order,
                is_active: category.is_active,
            },
            create: category,
        })
    }
}

export async function seedNews(prisma: PrismaClient) {
    const categories = await prisma.newsCategory.findMany({
        where: {
            slug: {
                in: newsSeedItems.map(item => item.categorySlug),
            },
        },
        select: {
            id: true,
            slug: true,
        },
    })
    const categoriesBySlug = new Map(categories.map(category => [category.slug, category.id]))

    for (const item of newsSeedItems) {
        await prisma.news.upsert({
            where: {
                slug: item.slug,
            },
            update: {
                title: item.title,
                excerpt: item.excerpt,
                content: item.content,
                cover_image_url: item.cover_image_url,
                is_published: item.is_published,
                published_at: item.published_at ? new Date(item.published_at) : null,
                category_id: categoriesBySlug.get(item.categorySlug) ?? null,
                deleted_at: null,
            },
            create: {
                slug: item.slug,
                title: item.title,
                excerpt: item.excerpt,
                content: item.content,
                cover_image_url: item.cover_image_url,
                is_published: item.is_published,
                published_at: item.published_at ? new Date(item.published_at) : null,
                category_id: categoriesBySlug.get(item.categorySlug) ?? null,
            },
        })
    }
}

export async function seedSiteSettings(prisma: PrismaClient) {
    await prisma.siteSettings.upsert({
        where: {
            site_key: SITE_SETTINGS_SINGLETON_KEY,
        },
        update: {
            gia_hotline_phone: DEFAULT_SITE_SETTINGS.giaHotlinePhone,
            information_phone: DEFAULT_SITE_SETTINGS.informationPhone,
            ege_trust_phone: DEFAULT_SITE_SETTINGS.egeTrustPhone,
            email: DEFAULT_SITE_SETTINGS.email,
            home_sections_order: [...DEFAULT_SITE_SETTINGS.homeSectionsOrder],
        },
        create: {
            site_key: SITE_SETTINGS_SINGLETON_KEY,
            gia_hotline_phone: DEFAULT_SITE_SETTINGS.giaHotlinePhone,
            information_phone: DEFAULT_SITE_SETTINGS.informationPhone,
            ege_trust_phone: DEFAULT_SITE_SETTINGS.egeTrustPhone,
            email: DEFAULT_SITE_SETTINGS.email,
        },
    })
}

export async function seedSuperAdminSafe(prisma: PrismaClient, input: SuperAdminSeedInput) {
    const email = input.email?.trim()
    const password = input.password?.trim()

    if (!email || !password) {
        console.log('[seed] SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is not set. Super-admin seed skipped.')
        return
    }

    const existingUser = await prisma.user.findUnique({
        where: { email },
        select: {
            id: true,
            is_super_admin: true,
        },
    })

    if (!existingUser) {
        const hashedPassword = await hashPassword(password)

        await prisma.user.create({
            data: {
                name: 'Super Admin',
                email,
                password: hashedPassword,
                is_super_admin: true,
            },
        })

        console.log(`[seed] Super-admin created for ${email}.`)
        return
    }

    await prisma.user.update({
        where: { id: existingUser.id },
        data: {
            is_super_admin: true,
        },
    })

    console.log(`[seed] Super-admin already exists for ${email}. Password was not updated.`)
}

export async function seedSuperAdminForce(prisma: PrismaClient, input: SuperAdminSeedInput) {
    const email = input.email?.trim()
    const password = input.password?.trim()

    if (!email || !password) {
        throw new Error('SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is not set.')
    }

    const hashedPassword = await hashPassword(password)

    await prisma.user.upsert({
        where: { email },
        update: {
            name: 'Super Admin',
            password: hashedPassword,
            is_super_admin: true,
        },
        create: {
            name: 'Super Admin',
            email,
            password: hashedPassword,
            is_super_admin: true,
        },
    })

    console.log(`[seed] Super-admin force-upserted for ${email}. Password was updated.`)
}
