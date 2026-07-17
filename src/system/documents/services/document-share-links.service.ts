import { createReadStream } from 'node:fs'

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { DocumentStatus, Prisma } from '@prisma/client'

import { createDocumentShareToken, hashDocumentShareToken } from './document-share-link-token'
import { ErrorCodeEnum } from '../../../_helpers/enums/validator/error.code.enum'
import { ErrorDto } from '../../../_helpers/errors/error.dto'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateDocumentShareLinkDto } from '../dto/create-document-share-link.dto'
import { CreatedDocumentShareLinkDto } from '../dto/created-document-share-link.dto'
import { DocumentShareLinkDto } from '../dto/document-share-link.dto'
import { ResolveDocumentShareLinkDto } from '../dto/resolve-document-share-link.dto'
import { getDocumentContentDisposition } from '../policies/document-file.policy'
import { DocumentStorage } from '../storage/document-storage'

type ShareLinkWithRelations = Prisma.DocumentShareLinkGetPayload<{
    include: { document_version: { include: { document: true } } }
}>

export type ShareFile = {
    stream: ReturnType<typeof createReadStream>
    mimeType: string
    originalFilename: string
    sizeBytes: bigint
    disposition: string
}

@Injectable()
export class DocumentShareLinksService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: DocumentStorage
    ) {}

    async create(
        versionId: number,
        dto: CreateDocumentShareLinkDto,
        userId: number
    ): Promise<CreatedDocumentShareLinkDto> {
        const version = await this.findVersionOrThrow(versionId)
        this.ensureShareableStatus(version.document.status)
        await this.ensurePhysicalFile(version.storage_key)
        const expiresAt = this.parseExpiry(dto.expiresAt)

        for (let attempt = 0; attempt < 3; attempt += 1) {
            const generated = createDocumentShareToken()
            try {
                const link = await this.prisma.documentShareLink.create({
                    data: {
                        document_version_id: version.id,
                        token_hash: generated.tokenHash,
                        token_prefix: generated.tokenPrefix,
                        expires_at: expiresAt,
                        created_by_id: userId,
                    },
                    include: { document_version: { include: { document: true } } },
                })
                return {
                    ...this.toDto(link),
                    token: generated.token,
                    sharePath: `/share/document#${generated.token}`,
                }
            } catch (error) {
                if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
            }
        }

        throw new BadRequestException(
            new ErrorDto(
                ErrorCodeEnum.DOCUMENT_SHARE_LINK_UNAVAILABLE,
                'Bad Request',
                400,
                'Unable to create share link'
            )
        )
    }

    async list(versionId: number): Promise<DocumentShareLinkDto[]> {
        const version = await this.findVersionOrThrow(versionId)
        const links = await this.prisma.documentShareLink.findMany({
            where: { document_version_id: version.id },
            include: { document_version: { include: { document: true } } },
            orderBy: { created_at: 'desc' },
        })
        return links.map(link => this.toDto(link))
    }

    async revoke(id: number): Promise<DocumentShareLinkDto> {
        const link = await this.findLinkOrThrow(id)
        if (!link.revoked_at) {
            await this.prisma.documentShareLink.update({ where: { id }, data: { revoked_at: new Date() } })
        }
        return this.toDto(
            await this.prisma.documentShareLink.findUniqueOrThrow({
                where: { id },
                include: { document_version: { include: { document: true } } },
            })
        )
    }

    async resolve(dto: ResolveDocumentShareLinkDto): Promise<ShareFile> {
        const link = await this.prisma.documentShareLink.findUnique({
            where: { token_hash: hashDocumentShareToken(dto.token) },
            include: { document_version: { include: { document: true } } },
        })
        const now = new Date()
        if (
            !link ||
            link.revoked_at ||
            (link.expires_at && link.expires_at <= now) ||
            link.document_version.document.deleted_at ||
            link.document_version.document.status === DocumentStatus.ARCHIVED ||
            !(await this.storage.exists(link.document_version.storage_key))
        ) {
            throw this.unavailable()
        }

        const accounted = await this.prisma.documentShareLink.updateMany({
            where: { id: link.id, revoked_at: null },
            data: { access_count: { increment: 1 }, last_access_at: now },
        })
        if (accounted.count !== 1) throw this.unavailable()

        return {
            stream: this.storage.createReadStream(link.document_version.storage_key),
            mimeType: link.document_version.mime_type,
            originalFilename: link.document_version.original_filename,
            sizeBytes: link.document_version.size_bytes,
            disposition: getDocumentContentDisposition(
                link.document_version.extension,
                link.document_version.original_filename
            ),
        }
    }

    private async findVersionOrThrow(
        versionId: number
    ): Promise<Prisma.DocumentVersionGetPayload<{ include: { document: true } }>> {
        const version = await this.prisma.documentVersion.findFirst({
            where: { id: versionId, document: { deleted_at: null } },
            include: { document: true },
        })
        if (!version) {
            throw new NotFoundException(
                new ErrorDto(ErrorCodeEnum.DOCUMENT_VERSION_NOT_FOUND, 'Not Found', 404, 'Document version not found')
            )
        }
        return version
    }

    private async findLinkOrThrow(id: number): Promise<ShareLinkWithRelations> {
        const link = await this.prisma.documentShareLink.findFirst({
            where: { id, document_version: { document: { deleted_at: null } } },
            include: { document_version: { include: { document: true } } },
        })
        if (!link) {
            throw new NotFoundException(
                new ErrorDto(ErrorCodeEnum.DOCUMENT_SHARE_LINK_NOT_FOUND, 'Not Found', 404, 'Share link not found')
            )
        }
        return link
    }

    private ensureShareableStatus(status: DocumentStatus) {
        if (status === DocumentStatus.ARCHIVED) {
            throw new BadRequestException(
                new ErrorDto(
                    ErrorCodeEnum.DOCUMENT_STATUS_INVALID,
                    'Bad Request',
                    400,
                    'Archived documents cannot be shared'
                )
            )
        }
    }

    private async ensurePhysicalFile(storageKey: string) {
        if (!(await this.storage.exists(storageKey))) throw this.unavailable()
    }

    private parseExpiry(value?: string | null) {
        if (!value) return null
        const expiresAt = new Date(value)
        if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
            throw new BadRequestException(
                new ErrorDto(
                    ErrorCodeEnum.DOCUMENT_SHARE_LINK_EXPIRY_INVALID,
                    'Bad Request',
                    400,
                    'Expiry must be in the future'
                )
            )
        }
        return expiresAt
    }

    private toDto(link: ShareLinkWithRelations): DocumentShareLinkDto {
        const isExpired = Boolean(link.expires_at && link.expires_at <= new Date())
        return {
            id: link.id,
            tokenPrefix: link.token_prefix,
            expiresAt: link.expires_at,
            revokedAt: link.revoked_at,
            createdAt: link.created_at,
            lastAccessAt: link.last_access_at,
            accessCount: link.access_count,
            isActive:
                !link.revoked_at &&
                !isExpired &&
                !link.document_version.document.deleted_at &&
                link.document_version.document.status !== DocumentStatus.ARCHIVED,
            isExpired,
            versionId: link.document_version.id,
            versionNumber: link.document_version.version_number,
            documentId: link.document_version.document.id,
            documentTitle: link.document_version.document.title,
        }
    }

    private unavailable() {
        return new NotFoundException(
            new ErrorDto(
                ErrorCodeEnum.DOCUMENT_SHARE_LINK_UNAVAILABLE,
                'Not Found',
                404,
                'Document share link is unavailable'
            )
        )
    }
}
