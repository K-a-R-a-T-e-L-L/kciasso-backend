import {
    getDocumentContentDisposition,
    getDocumentExtension,
    getPublicDocumentMimeType,
    isDocumentMimeTypeAllowed,
    matchesDocumentSignature,
    normalizeOriginalFilename,
    validateDocumentSize,
} from './document-file.policy'

describe('document file policy', () => {
    it.each([
        ['report.pdf', 'pdf'],
        ['image.PNG', 'png'],
        ['table.xlsx', 'xlsx'],
        ['archive.zip', 'zip'],
    ])('extracts the normalized extension from %s', (filename, extension) => {
        expect(getDocumentExtension(filename)).toBe(extension)
    })

    it('keeps unicode names and preserves names that cannot be safely decoded', () => {
        expect(normalizeOriginalFilename('Приказ.pdf')).toBe('Приказ.pdf')
        expect(normalizeOriginalFilename('РџСЂРёРєР°Р·.pdf')).toBe('РџСЂРёРєР°Р·.pdf')
    })

    it('checks extension and MIME consistency', () => {
        expect(isDocumentMimeTypeAllowed('pdf', 'application/pdf')).toBe(true)
        expect(isDocumentMimeTypeAllowed('docx', 'application/zip')).toBe(true)
        expect(isDocumentMimeTypeAllowed('pdf', 'image/png')).toBe(false)
        expect(isDocumentMimeTypeAllowed('exe', 'application/octet-stream')).toBe(false)
    })

    it('validates file size against the configured limit', () => {
        expect(validateDocumentSize(100, 100)).toBe(true)
        expect(validateDocumentSize(101, 100)).toBe(false)
    })

    it.each([
        ['pdf', Buffer.from('%PDF-1.7'), true],
        ['png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), true],
        ['jpg', Buffer.from([255, 216, 255, 0]), true],
        ['docx', Buffer.from([80, 75, 3, 4]), true],
        ['pdf', Buffer.from('not a pdf'), false],
    ])('validates the %s signature', (extension, signature, expected) => {
        expect(matchesDocumentSignature(extension, signature)).toBe(expected)
    })

    it('allows only safe public MIME types and returns normalized MIME', () => {
        expect(getPublicDocumentMimeType('PDF', 'APPLICATION/PDF')).toBe('application/pdf')
        expect(getPublicDocumentMimeType('docx', 'text/plain')).toBeNull()
    })

    it('builds safe inline/attachment content disposition', () => {
        expect(getDocumentContentDisposition('pdf', 'my report.pdf')).toBe(
            'inline; filename="document"; filename*=UTF-8\'\'my%20report.pdf'
        )
        expect(getDocumentContentDisposition('zip', 'bad"name.zip')).toContain('attachment;')
        expect(getDocumentContentDisposition('zip', '')).toContain('document.zip')
    })
})
