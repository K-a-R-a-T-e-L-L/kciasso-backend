import { validateNewsImage } from './news-media.policy'

describe('news media policy', () => {
    it.each([
        ['cover.jpg', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
        ['cover.png', 'image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        ['cover.webp', 'image/webp', Buffer.from('RIFF0000WEBP')],
    ])('accepts %s with matching MIME and signature', (name, mime, buffer) => {
        expect(validateNewsImage({ originalname: name, mimetype: mime, size: buffer.length, buffer })).toBeDefined()
    })

    it('rejects SVG, mismatched signatures, unsupported extensions, and files over 10 MiB', () => {
        expect(() =>
            validateNewsImage({
                originalname: 'x.svg',
                mimetype: 'image/svg+xml',
                size: 5,
                buffer: Buffer.from('<svg>'),
            })
        ).toThrow()
        expect(() =>
            validateNewsImage({ originalname: 'x.png', mimetype: 'image/png', size: 4, buffer: Buffer.from('RIFF') })
        ).toThrow()
        expect(() =>
            validateNewsImage({ originalname: 'x.gif', mimetype: 'image/gif', size: 4, buffer: Buffer.from('GIF8') })
        ).toThrow()
        expect(() =>
            validateNewsImage({
                originalname: 'x.jpg',
                mimetype: 'image/jpeg',
                size: 10 * 1024 * 1024 + 1,
                buffer: Buffer.from([0xff, 0xd8, 0xff]),
            })
        ).toThrow()
    })
})
