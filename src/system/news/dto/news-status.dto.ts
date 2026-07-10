export const NEWS_STATUS = {
    DRAFT: 'draft',
    SCHEDULED: 'scheduled',
    PUBLISHED: 'published',
} as const

export type NewsStatus = (typeof NEWS_STATUS)[keyof typeof NEWS_STATUS]
