import { extname } from 'node:path'

export const ALLOWED_DOCUMENT_MIME_TYPES: Readonly<Record<string, readonly string[]>> = {
    pdf: ['application/pdf'],
    doc: ['application/msword', 'application/octet-stream'],
    docx: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip',
        'application/octet-stream',
    ],
    xls: ['application/vnd.ms-excel', 'application/octet-stream'],
    xlsx: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip',
        'application/octet-stream',
    ],
    zip: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
    jpg: ['image/jpeg'],
    jpeg: ['image/jpeg'],
    png: ['image/png'],
}

export function normalizeOriginalFilename(value: string): string {
    if (![...value].every(character => character.charCodeAt(0) <= 0xff)) return value
    const decoded = Buffer.from(value, 'latin1').toString('utf8')
    return decoded.includes('\uFFFD') ? value : decoded
}

export function getDocumentExtension(filename: string): string {
    return extname(filename).slice(1).toLowerCase()
}

export function isDocumentMimeTypeAllowed(extension: string, mimeType: string): boolean {
    return ALLOWED_DOCUMENT_MIME_TYPES[extension.toLowerCase()]?.includes(mimeType.toLowerCase()) ?? false
}

export function validateDocumentSize(sizeBytes: number, maxFileSizeBytes: number): boolean {
    return sizeBytes <= maxFileSizeBytes
}

export function matchesDocumentSignature(extension: string, signature: Buffer): boolean {
    const normalized = extension.toLowerCase()
    if (normalized === 'pdf') return signature.subarray(0, 5).toString('ascii') === '%PDF-'
    if (normalized === 'png') return signature.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    if (normalized === 'jpg' || normalized === 'jpeg') {
        return signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff
    }
    if (normalized === 'doc' || normalized === 'xls') {
        return signature.subarray(0, 8).equals(Buffer.from([208, 207, 17, 224, 161, 177, 26, 225]))
    }
    return signature[0] === 0x50 && signature[1] === 0x4b && signature[2] === 0x03 && signature[3] === 0x04
}

export function getPublicDocumentMimeType(extension: string, mimeType: string): string | null {
    const normalized = mimeType.toLowerCase()
    return isDocumentMimeTypeAllowed(extension, normalized) ? normalized : null
}

export function getDocumentContentDisposition(extension: string, filename: string): string {
    const safeFilename = filename.replace(/[\r\n"\\/\u0000-\u001F\u007F]/g, '_') || `document.${extension}`
    const encodedFilename = encodeURIComponent(safeFilename)
    const mode = ['pdf', 'jpg', 'jpeg', 'png'].includes(extension.toLowerCase()) ? 'inline' : 'attachment'
    return `${mode}; filename="document"; filename*=UTF-8''${encodedFilename}`
}
