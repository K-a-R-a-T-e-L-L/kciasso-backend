import { extname } from 'node:path'

import { BadRequestException } from '@nestjs/common'

export const NEWS_IMAGE_MAX_BYTES = 10 * 1024 * 1024
export type NewsImageFile = { originalname: string; mimetype: string; size: number; buffer: Buffer }

const TYPES = {
    '.jpg': {
        extension: 'jpg',
        mime: 'image/jpeg',
        signature: (value: Buffer) => value[0] === 0xff && value[1] === 0xd8 && value[2] === 0xff,
    },
    '.jpeg': {
        extension: 'jpg',
        mime: 'image/jpeg',
        signature: (value: Buffer) => value[0] === 0xff && value[1] === 0xd8 && value[2] === 0xff,
    },
    '.png': {
        extension: 'png',
        mime: 'image/png',
        signature: (value: Buffer) =>
            value.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    },
    '.webp': {
        extension: 'webp',
        mime: 'image/webp',
        signature: (value: Buffer) =>
            value.subarray(0, 4).toString() === 'RIFF' && value.subarray(8, 12).toString() === 'WEBP',
    },
} as const

export function validateNewsImage(file: NewsImageFile): { extension: 'jpg' | 'png' | 'webp'; mimeType: string } {
    if (!file || file.size <= 0 || file.size > NEWS_IMAGE_MAX_BYTES)
        throw new BadRequestException('News image must be at most 10 MiB')
    const type = TYPES[extname(file.originalname).toLowerCase() as keyof typeof TYPES]
    if (!type || file.mimetype.toLowerCase() !== type.mime || !type.signature(file.buffer)) {
        throw new BadRequestException('Only valid JPEG, PNG, and WebP news images are allowed')
    }
    return { extension: type.extension, mimeType: type.mime }
}
