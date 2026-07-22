import { createHash, randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { open, rm } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'

import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
    Optional,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DocumentStatus, Prisma, User } from '@prisma/client'

import { DocumentPlacementService } from './document-placement.service'
import { ErrorCodeEnum } from '../../../_helpers/enums/validator/error.code.enum'
import { ErrorDto } from '../../../_helpers/errors/error.dto'
import { getAppConfig } from '../../../config/app.config'
import { PrismaService } from '../../../prisma/prisma.service'
import { DOCUMENT_SECTIONS } from '../documents.constants'
import { CreateDocumentDto } from '../dto/create-document.dto'
import { DocumentPlacementPublicationDto } from '../dto/document-placement-publication.dto'
import { DocumentQueryDto, DocumentSortBy, DocumentSortDirection } from '../dto/document-query.dto'
import { DocumentVersionDto } from '../dto/document-version.dto'
import { DocumentDto } from '../dto/document.dto'
import { PaginatedDocumentsDto } from '../dto/paginated-documents.dto'
import { PublicDocumentDto } from '../dto/public-document.dto'
import { ReorderDocumentPlacementsDto } from '../dto/reorder-document-placements.dto'
import { UpdateDocumentPlacementsDto } from '../dto/update-document-placements.dto'
import { UpdateDocumentStatusDto } from '../dto/update-document-status.dto'
import { UpdateDocumentDto } from '../dto/update-document.dto'
import {
    DocumentWithRelations,
    mapDocumentToDto,
    mapPublicDocumentToDto,
    mapVersionToDto,
} from '../mappers/document.mapper'
import { DocumentAccessPolicy } from '../policies/document-access.policy'
import {
    ALLOWED_DOCUMENT_MIME_TYPES,
    getDocumentContentDisposition,
    getDocumentExtension,
    getPublicDocumentMimeType,
    matchesDocumentSignature,
    normalizeOriginalFilename,
    validateDocumentSize,
} from '../policies/document-file.policy'
import { DocumentStorage } from '../storage/document-storage'

export type UploadedFile = {
    path: string
    originalname: string
    mimetype: string
    size: number
}
type PreparedFile = { extension: string; mimeType: string; sizeBytes: number; sha256: string; originalFilename: string }
@Injectable()
export class DocumentsService {
    private readonly maxFileSizeBytes: number
    private readonly placementService: DocumentPlacementService
    private readonly accessPolicy: DocumentAccessPolicy
    private createDocumentMutex: Promise<void> = Promise.resolve()

    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: DocumentStorage,
        config: ConfigService,
        @Optional() placementService?: DocumentPlacementService,
        @Optional() accessPolicy?: DocumentAccessPolicy
    ) {
        this.placementService = placementService ?? new DocumentPlacementService(prisma)
        this.accessPolicy = accessPolicy ?? new DocumentAccessPolicy()
        this.maxFileSizeBytes = getAppConfig(config).documentMaxFileSizeBytes
    }

    async createDocument(dto: CreateDocumentDto, file: UploadedFile | undefined, actor: User): Promise<DocumentDto> {
        const previous = this.createDocumentMutex
        let release!: () => void
        this.createDocumentMutex = new Promise<void>(resolve => {
            release = resolve
        })
        await previous
        try {
            return await this.createDocumentUnlocked(dto, file, actor)
        } finally {
            release()
        }
    }

    private async createDocumentUnlocked(
        dto: CreateDocumentDto,
        file: UploadedFile | undefined,
        actor: User
    ): Promise<DocumentDto> {
        const sections = this.placementService.validatePlacementKeys(dto.placementKeys)
        try {
            sections.forEach(section => this.accessPolicy.assertPlacementAccess(actor, section.key))
        } catch (error) {
            await this.removeTempFile(file?.path)
            throw error
        }
        const prepared = await this.prepareFile(file)
        const storedFileModel = (this.prisma as PrismaService & { storedFile?: typeof this.prisma.storedFile })
            .storedFile
        const existingBlob = storedFileModel
            ? await storedFileModel.findUnique({ where: { sha256: prepared.sha256 } })
            : null
        const existingPhysical = existingBlob ? await this.storage.exists(existingBlob.storage_key) : false
        const reuseBlob = existingBlob && existingPhysical ? existingBlob : null
        if (existingBlob && !existingPhysical && storedFileModel)
            await storedFileModel.delete({ where: { id: existingBlob.id } }).catch(() => undefined)
        const storageKey = reuseBlob?.storage_key ?? this.createStorageKey(prepared.extension)

        try {
            if (!reuseBlob) await this.storage.moveTempFile(file!.path, storageKey)
            else await this.removeTempFile(file?.path)
        } catch {
            await this.removeTempFile(file?.path)
            throw new BadRequestException(
                new ErrorDto(
                    ErrorCodeEnum.DOCUMENT_STORAGE_WRITE_FAILED,
                    'Bad Request',
                    400,
                    'Document storage write failed'
                )
            )
        }

        try {
            const document = await this.prisma.$transaction(async transaction => {
                const created = await transaction.document.create({
                    data: {
                        section_key: sections[0].key,
                        title: dto.title.trim(),
                        description: dto.description?.trim() || null,
                        document_number: dto.documentNumber?.trim() || null,
                        document_date: dto.documentDate ? new Date(dto.documentDate) : null,
                        status: DocumentStatus.DRAFT,
                        created_by_id: actor.id,
                        updated_by_id: actor.id,
                    },
                })
                await this.placementService.createInitialPlacements(transaction, created.id, sections)
                const transactionStoredFile = (
                    transaction as Prisma.TransactionClient & { storedFile?: typeof transaction.storedFile }
                ).storedFile
                const storedFileId =
                    reuseBlob?.id ??
                    (transactionStoredFile
                        ? (
                              await transactionStoredFile.create({
                                  data: {
                                      sha256: prepared.sha256,
                                      storage_key: storageKey,
                                      extension: prepared.extension,
                                      mime_type: prepared.mimeType,
                                      size_bytes: prepared.sizeBytes,
                                  },
                              })
                          ).id
                        : undefined)
                const version = await transaction.documentVersion.create({
                    data: {
                        document_id: created.id,
                        version_number: 1,
                        storage_key: storageKey,
                        original_filename: prepared.originalFilename,
                        extension: prepared.extension,
                        mime_type: prepared.mimeType,
                        size_bytes: prepared.sizeBytes,
                        sha256: prepared.sha256,
                        ...(storedFileId ? { stored_file_id: storedFileId } : {}),
                        created_by_id: actor.id,
                    },
                })
                await transaction.document.update({
                    where: { id: created.id },
                    data: { current_version_id: version.id },
                })
                return transaction.document.findUniqueOrThrow({
                    where: { id: created.id },
                    include: { current_version: true, placements: true, _count: { select: { versions: true } } },
                })
            })

            return this.mapForActor(document, actor)
        } catch (error) {
            if (!reuseBlob) await this.storage.delete(storageKey)
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException(
                    new ErrorDto(
                        ErrorCodeEnum.DOCUMENT_DUPLICATE_VERSION,
                        'Conflict',
                        409,
                        'Duplicate document version'
                    )
                )
            }
            throw error
        }
    }

    async createVersion(documentId: number, file: UploadedFile | undefined, actor: User): Promise<DocumentDto> {
        if (!actor.is_super_admin) {
            await this.removeTempFile(file?.path)
            throw new ForbiddenException('Only SUPER_ADMIN can replace a shared document version')
        }
        const prepared = await this.prepareFile(file)
        const existing = await this.findDocumentOrThrow(documentId)
        this.accessPolicy.assertCanManage(actor, existing.placements)
        const duplicate = await this.prisma.documentVersion.findFirst({
            where: { document_id: documentId, sha256: prepared.sha256 },
        })
        if (duplicate) {
            await this.removeTempFile(file?.path)
            throw new ConflictException(
                new ErrorDto(
                    ErrorCodeEnum.DOCUMENT_DUPLICATE_VERSION,
                    'Conflict',
                    409,
                    'The same file is already a document version'
                )
            )
        }

        const storedFileModel = (this.prisma as PrismaService & { storedFile?: typeof this.prisma.storedFile })
            .storedFile
        const existingBlob = storedFileModel
            ? await storedFileModel.findUnique({ where: { sha256: prepared.sha256 } })
            : null
        const existingPhysical = existingBlob ? await this.storage.exists(existingBlob.storage_key) : false
        const reuseBlob = existingBlob && existingPhysical ? existingBlob : null
        if (existingBlob && !existingPhysical && storedFileModel)
            await storedFileModel.delete({ where: { id: existingBlob.id } }).catch(() => undefined)
        const storageKey = reuseBlob?.storage_key ?? this.createStorageKey(prepared.extension)
        try {
            if (!reuseBlob) await this.storage.moveTempFile(file!.path, storageKey)
            else await this.removeTempFile(file?.path)
        } catch {
            await this.removeTempFile(file?.path)
            throw new BadRequestException(
                new ErrorDto(
                    ErrorCodeEnum.DOCUMENT_STORAGE_WRITE_FAILED,
                    'Bad Request',
                    400,
                    'Document storage write failed'
                )
            )
        }

        try {
            const result = await this.prisma.$transaction(async transaction => {
                const latest = await transaction.documentVersion.aggregate({
                    where: { document_id: documentId },
                    _max: { version_number: true },
                })
                const transactionStoredFile = (
                    transaction as Prisma.TransactionClient & { storedFile?: typeof transaction.storedFile }
                ).storedFile
                const storedFileId =
                    reuseBlob?.id ??
                    (transactionStoredFile
                        ? (
                              await transactionStoredFile.create({
                                  data: {
                                      sha256: prepared.sha256,
                                      storage_key: storageKey,
                                      extension: prepared.extension,
                                      mime_type: prepared.mimeType,
                                      size_bytes: prepared.sizeBytes,
                                  },
                              })
                          ).id
                        : undefined)
                const version = await transaction.documentVersion.create({
                    data: {
                        document_id: documentId,
                        version_number: (latest._max.version_number ?? 0) + 1,
                        storage_key: storageKey,
                        original_filename: prepared.originalFilename,
                        extension: prepared.extension,
                        mime_type: prepared.mimeType,
                        size_bytes: prepared.sizeBytes,
                        sha256: prepared.sha256,
                        ...(storedFileId ? { stored_file_id: storedFileId } : {}),
                        created_by_id: actor.id,
                    },
                })
                await transaction.document.update({
                    where: { id: documentId },
                    data: { current_version_id: version.id, updated_by_id: actor.id },
                })
                return transaction.document.findUniqueOrThrow({
                    where: { id: documentId },
                    include: { current_version: true, placements: true, _count: { select: { versions: true } } },
                })
            })
            return this.mapForActor(result, actor)
        } catch (error) {
            if (!reuseBlob) await this.storage.delete(storageKey)
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException(
                    new ErrorDto(
                        ErrorCodeEnum.DOCUMENT_DUPLICATE_VERSION,
                        'Conflict',
                        409,
                        'The same file is already a document version'
                    )
                )
            }
            throw error
        }
    }

    async getDocuments(query: DocumentQueryDto, actor: User): Promise<PaginatedDocumentsDto> {
        const pageSize = query.pageSize ?? query.limit ?? 20
        const placementKey = query.placementKey?.trim() || undefined
        const section = placementKey ? this.placementService.getSectionOrThrow(placementKey) : undefined
        if (section) this.accessPolicy.assertPlacementAccess(actor, section.key)
        const groupKeys = query.group
            ? DOCUMENT_SECTIONS.filter(item => item.group === this.toGroupKey(query.group!)).map(item => item.key)
            : undefined
        if (query.group && (!groupKeys || groupKeys.length === 0))
            throw new BadRequestException('Unknown document group')
        if (section && query.group && section.group !== this.toGroupKey(query.group)) {
            throw new BadRequestException('Placement does not belong to selected group')
        }
        const allowedKeys = DOCUMENT_SECTIONS.filter(item => this.accessPolicy.canAccessPlacement(actor, item.key)).map(
            item => item.key
        )
        if (allowedKeys.length === 0) throw new BadRequestException('No document placements are available')
        if (query.group && !groupKeys!.some(key => allowedKeys.includes(key)))
            throw new ForbiddenException('Document group access is required')
        if (query.sortBy === DocumentSortBy.PLACEMENT_ORDER && !section)
            throw new BadRequestException('Placement order requires an exact placement')
        const scopeKeys = section
            ? [section.key]
            : groupKeys
              ? groupKeys.filter(key => allowedKeys.includes(key))
              : allowedKeys
        const where: Prisma.DocumentWhereInput = {
            placements: { some: { section_key: { in: scopeKeys } } },
            deleted_at: null,
            ...(query.status ? { status: query.status } : {}),
            ...(query.search
                ? {
                      OR: [
                          { title: { contains: query.search, mode: 'insensitive' } },
                          { description: { contains: query.search, mode: 'insensitive' } },
                          { document_number: { contains: query.search, mode: 'insensitive' } },
                      ],
                  }
                : {}),
        }
        const orderBy: Prisma.DocumentOrderByWithRelationInput[] = this.documentOrderBy(query, section?.key)
        const result = await this.prisma.$transaction(async transaction => {
            const total = await transaction.document.count({ where })
            const totalPages = Math.ceil(total / pageSize)
            const page = total > 0 ? Math.min(query.page, totalPages) : 1
            let items = await transaction.document.findMany({
                where,
                orderBy,
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: { current_version: true, placements: true, _count: { select: { versions: true } } },
            })
            if (query.sortBy === DocumentSortBy.PLACEMENT_ORDER && section) {
                const ordered = await transaction.documentPlacement.findMany({
                    where: { section_key: section.key, document: where },
                    orderBy: [{ sort_order: query.sortDirection ?? 'asc' }, { document_id: 'asc' }],
                    skip: (page - 1) * pageSize,
                    take: pageSize,
                    select: { document_id: true },
                })
                const ids = ordered.map(item => item.document_id)
                const loaded = await transaction.document.findMany({
                    where: { ...where, id: { in: ids } },
                    include: { current_version: true, placements: true, _count: { select: { versions: true } } },
                })
                const byId = new Map(loaded.map(item => [item.id, item]))
                items = ids.map(id => byId.get(id)).filter((item): item is (typeof loaded)[number] => Boolean(item))
            }
            return { items, total, page, totalPages }
        })
        return {
            items: result.items.map(item => this.mapForActor(item, actor)),
            meta: { page: result.page, pageSize, total: result.total, totalPages: result.totalPages },
        }
    }

    async getDocument(id: number, actor: User): Promise<DocumentDto> {
        const document = await this.findDocumentOrThrow(id)
        this.accessPolicy.assertCanManage(actor, document.placements)
        return this.mapForActor(document, actor)
    }

    async getVersions(id: number, actor: User): Promise<DocumentVersionDto[]> {
        const document = await this.findDocumentOrThrow(id)
        this.accessPolicy.assertCanManage(actor, document.placements)
        const versions = await this.prisma.documentVersion.findMany({
            where: { document_id: document.id },
            orderBy: { version_number: 'asc' },
            include: { current_for: true },
        })
        return versions.map(version => mapVersionToDto(version, version.current_for?.id === document.id))
    }

    async updateDocument(id: number, dto: UpdateDocumentDto, actor: User): Promise<DocumentDto> {
        const existingDocument = await this.findDocumentOrThrow(id)
        this.accessPolicy.assertCanManage(actor, existingDocument.placements)
        if (dto.title !== undefined && !dto.title.trim()) {
            throw new BadRequestException(
                new ErrorDto(ErrorCodeEnum.DOCUMENT_TITLE_REQUIRED, 'Bad Request', 400, 'Document title is required')
            )
        }
        const document = await this.prisma.document.update({
            where: { id },
            data: {
                ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
                ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
                ...(dto.documentNumber !== undefined ? { document_number: dto.documentNumber?.trim() || null } : {}),
                ...(dto.documentDate !== undefined
                    ? { document_date: dto.documentDate ? new Date(dto.documentDate) : null }
                    : {}),
                updated_by_id: actor.id,
            },
            include: { current_version: true, placements: true, _count: { select: { versions: true } } },
        })
        return this.mapForActor(document, actor)
    }

    async updateStatus(id: number, dto: UpdateDocumentStatusDto, actor: User): Promise<DocumentDto> {
        if (!actor.is_super_admin) throw new ForbiddenException('Only SUPER_ADMIN can change global document status')
        const existing = await this.findDocumentOrThrow(id)
        this.accessPolicy.assertCanManage(actor, existing.placements)
        if (dto.status !== 'DRAFT' && dto.status !== 'PUBLISHED') {
            throw new BadRequestException(
                new ErrorDto(
                    ErrorCodeEnum.DOCUMENT_STATUS_INVALID,
                    'Bad Request',
                    400,
                    'Only DRAFT and PUBLISHED are supported'
                )
            )
        }
        if (dto.status === 'PUBLISHED') {
            if (!existing.current_version || !(await this.storage.exists(existing.current_version.storage_key))) {
                throw new BadRequestException(
                    new ErrorDto(
                        ErrorCodeEnum.DOCUMENT_CURRENT_VERSION_UNAVAILABLE,
                        'Bad Request',
                        400,
                        'A current physical version is required before publishing'
                    )
                )
            }
        }

        const document = await this.prisma.document.update({
            where: { id },
            data: { status: dto.status as DocumentStatus, updated_by_id: actor.id },
            include: { current_version: true, placements: true, _count: { select: { versions: true } } },
        })
        return this.mapForActor(document, actor)
    }

    async makeCurrent(documentId: number, versionId: number, actor: User): Promise<DocumentDto> {
        if (!actor.is_super_admin)
            throw new ForbiddenException('Only SUPER_ADMIN can replace a shared document version')
        const existingDocument = await this.findDocumentOrThrow(documentId)
        this.accessPolicy.assertCanManage(actor, existingDocument.placements)
        const version = await this.prisma.documentVersion.findFirst({
            where: { id: versionId, document_id: documentId },
        })
        if (!version) {
            throw new NotFoundException(
                new ErrorDto(ErrorCodeEnum.DOCUMENT_VERSION_NOT_FOUND, 'Not Found', 404, 'Document version not found')
            )
        }
        if (!(await this.storage.exists(version.storage_key))) {
            throw new NotFoundException(
                new ErrorDto(
                    ErrorCodeEnum.DOCUMENT_CURRENT_VERSION_UNAVAILABLE,
                    'Not Found',
                    404,
                    'Document version file is unavailable'
                )
            )
        }

        const document = await this.prisma.$transaction(async transaction => {
            await transaction.document.update({
                where: { id: documentId },
                data: { current_version_id: versionId, updated_by_id: actor.id },
            })
            return transaction.document.findUniqueOrThrow({
                where: { id: documentId },
                include: { current_version: true, placements: true, _count: { select: { versions: true } } },
            })
        })
        return this.mapForActor(document, actor)
    }

    async updatePlacements(id: number, dto: UpdateDocumentPlacementsDto, actor: User): Promise<DocumentDto> {
        const document = await this.findDocumentOrThrow(id)
        dto.placementKeys.forEach(key => this.accessPolicy.assertPlacementAccess(actor, key))
        const hiddenKeys = actor.is_super_admin
            ? []
            : document.placements
                  .filter(item => !this.accessPolicy.canAccessPlacement(actor, item.section_key))
                  .map(item => item.section_key)
        const nextKeys = [...new Set([...hiddenKeys, ...dto.placementKeys])]
        await this.placementService.replacePlacements(id, nextKeys)
        return this.mapForActor(await this.findDocumentOrThrow(document.id), actor)
    }

    async reorderPlacements(dto: ReorderDocumentPlacementsDto, actor: User): Promise<PaginatedDocumentsDto> {
        this.accessPolicy.assertPlacementAccess(actor, dto.sectionKey)
        const result = await this.placementService.reorderPlacements(dto)
        return this.getDocuments(
            {
                placementKey: result.sectionKey,
                page: 1,
                pageSize: Math.min(100, Math.max(20, result.documentCount)),
                sortBy: DocumentSortBy.PLACEMENT_ORDER,
                sortDirection: DocumentSortDirection.ASC,
            },
            actor
        )
    }

    async getDocumentFile(documentId: number, versionId: number, actor: User) {
        const document = await this.findDocumentOrThrow(documentId)
        this.accessPolicy.assertCanManage(actor, document.placements)
        const version = await this.prisma.documentVersion.findFirst({
            where: { id: versionId, document_id: documentId, document: { deleted_at: null } },
        })
        if (!version) {
            throw new NotFoundException(
                new ErrorDto(ErrorCodeEnum.DOCUMENT_VERSION_NOT_FOUND, 'Not Found', 404, 'Document version not found')
            )
        }
        if (!(await this.storage.exists(version.storage_key))) {
            throw new NotFoundException(
                new ErrorDto(
                    ErrorCodeEnum.DOCUMENT_CURRENT_VERSION_UNAVAILABLE,
                    'Not Found',
                    404,
                    'Document version file is unavailable'
                )
            )
        }
        return {
            stream: this.storage.createReadStream(version.storage_key),
            mimeType: version.mime_type,
            originalFilename: version.original_filename,
            sizeBytes: version.size_bytes,
        }
    }

    async getPublicDocuments(sectionKey: string): Promise<PublicDocumentDto[]> {
        const section = this.placementService.getSectionOrThrow(sectionKey)
        const documents = await this.prisma.document.findMany({
            where: {
                placements: {
                    some: {
                        section_key: section.key,
                        AND: [
                            {
                                OR: [
                                    { publication_status: { in: ['PUBLISHED', 'SCHEDULED'] } },
                                    { publication_status: 'DRAFT', document: { status: DocumentStatus.PUBLISHED } },
                                ],
                            },
                            { OR: [{ publish_from: null }, { publish_from: { lte: new Date() } }] },
                            { OR: [{ publish_until: null }, { publish_until: { gt: new Date() } }] },
                        ],
                    },
                },
                deleted_at: null,
                current_version: { isNot: null },
            },
            include: { current_version: true, placements: true, _count: { select: { versions: true } } },
        })
        documents.sort((a, b) => {
            const aOrder = a.placements.find(item => item.section_key === section.key)?.sort_order ?? 0
            const bOrder = b.placements.find(item => item.section_key === section.key)?.sort_order ?? 0
            return aOrder - bOrder || a.id - b.id
        })
        const available = [] as PublicDocumentDto[]
        for (const document of documents) {
            if (!document.current_version || !(await this.storage.exists(document.current_version.storage_key))) {
                console.warn('Published document has no physical current file')
                continue
            }
            const mapped = mapPublicDocumentToDto(document)
            if (mapped) available.push(mapped)
        }
        return available
    }

    async getPublicDocumentFile(documentId: number) {
        const document = await this.prisma.document.findFirst({
            where: {
                id: documentId,
                deleted_at: null,
                placements: {
                    some: {
                        AND: [
                            {
                                OR: [
                                    { publication_status: { in: ['PUBLISHED', 'SCHEDULED'] } },
                                    { publication_status: 'DRAFT', document: { status: DocumentStatus.PUBLISHED } },
                                ],
                            },
                            { OR: [{ publish_from: null }, { publish_from: { lte: new Date() } }] },
                            { OR: [{ publish_until: null }, { publish_until: { gt: new Date() } }] },
                        ],
                    },
                },
            },
            include: { current_version: true },
        })
        const version = document?.current_version
        const mimeType = version ? getPublicDocumentMimeType(version.extension, version.mime_type) : null
        if (!document || !version || !mimeType || !(await this.storage.exists(version.storage_key))) {
            throw new NotFoundException(
                new ErrorDto(
                    ErrorCodeEnum.DOCUMENT_PUBLIC_FILE_UNAVAILABLE,
                    'Not Found',
                    404,
                    'Document is unavailable'
                )
            )
        }
        return {
            stream: this.storage.createReadStream(version.storage_key),
            mimeType,
            originalFilename: version.original_filename,
            sizeBytes: version.size_bytes,
            disposition: getDocumentContentDisposition(version.extension, version.original_filename),
        }
    }

    async applyPlacementPublication(
        documentId: number,
        sectionKey: string,
        dto: DocumentPlacementPublicationDto,
        actor: User
    ) {
        const document = await this.findDocumentOrThrow(documentId)
        const placement = document.placements.find(item => item.section_key === sectionKey)
        if (!placement)
            throw new NotFoundException(
                new ErrorDto(ErrorCodeEnum.DOCUMENT_SECTION_NOT_FOUND, 'Not Found', 404, 'Document placement not found')
            )
        this.accessPolicy.assertPlacementAccess(actor, sectionKey)
        const now = new Date()
        const from = dto.publishFrom ? new Date(dto.publishFrom) : now
        const until = dto.publishUntil ? new Date(dto.publishUntil) : null
        const display = dto.displayPublishedAt ? new Date(dto.displayPublishedAt) : from
        if (until && until <= from) throw new BadRequestException('publishUntil must be after publishFrom')
        if (dto.command === 'schedule' && from <= now)
            throw new BadRequestException('publishFrom must be in the future')
        if (
            dto.command !== 'draft' &&
            (!document.current_version || !(await this.storage.exists(document.current_version.storage_key)))
        )
            throw new BadRequestException('A current physical version is required before publishing')
        const data =
            dto.command === 'draft'
                ? { publication_status: 'DRAFT' as const, publish_from: null, publish_until: null }
                : dto.command === 'schedule'
                  ? { publication_status: 'SCHEDULED' as const, publish_from: from, publish_until: until }
                  : { publication_status: 'PUBLISHED' as const, publish_from: now, publish_until: until }
        await this.prisma.documentPlacement.update({
            where: { id: placement.id },
            data: {
                ...data,
                display_published_at: dto.command === 'draft' ? placement.display_published_at : display,
                publication_revision: { increment: 1 },
            },
        })
        return this.mapForActor(await this.findDocumentOrThrow(documentId), actor)
    }

    async deleteDocument(id: number, actor: User): Promise<void> {
        if (!actor.is_super_admin) throw new ForbiddenException('Only SUPER_ADMIN can delete a document globally')
        const authorizedDocument = await this.findDocumentOrThrow(id)
        this.accessPolicy.assertCanManage(actor, authorizedDocument.placements)
        const document = await this.prisma.document.findFirst({
            where: { id, deleted_at: null },
            include: { versions: true },
        })
        if (!document) {
            throw new NotFoundException(
                new ErrorDto(ErrorCodeEnum.DOCUMENT_NOT_FOUND, 'Not Found', 404, 'Document not found')
            )
        }
        const quarantined: Array<{ key: string; storageKey: string }> = []
        const storedFileIds = document.versions
            .map(version => version.stored_file_id)
            .filter((id): id is number => id !== null)
        try {
            for (const version of document.versions) {
                if (!(await this.storage.exists(version.storage_key))) continue
                if (version.stored_file_id) {
                    const refs = await this.prisma.documentVersion.count({
                        where: { stored_file_id: version.stored_file_id },
                    })
                    if (refs > 1) continue
                }
                quarantined.push({
                    key: await this.storage.quarantine(version.storage_key),
                    storageKey: version.storage_key,
                })
            }
            await this.prisma.$transaction(async transaction => {
                await transaction.documentShareLink.deleteMany({ where: { document_version: { document_id: id } } })
                await transaction.document.update({ where: { id }, data: { current_version_id: null } })
                await transaction.documentPlacement.deleteMany({ where: { document_id: id } })
                await transaction.documentVersion.deleteMany({ where: { document_id: id } })
                await transaction.document.delete({ where: { id } })
            })
        } catch (error) {
            for (const item of [...quarantined].reverse())
                await this.storage.restore(item.key, item.storageKey).catch(() => undefined)
            throw error
        }
        for (const item of quarantined) await this.storage.purgeQuarantine(item.key).catch(() => undefined)
        for (const storedFileId of storedFileIds) {
            const refs = await this.prisma.documentVersion.count({ where: { stored_file_id: storedFileId } })
            if (refs === 0) await this.prisma.storedFile.delete({ where: { id: storedFileId } }).catch(() => undefined)
        }
    }

    private async findDocumentOrThrow(id: number): Promise<DocumentWithRelations> {
        const document = await this.prisma.document.findFirst({
            where: { id, deleted_at: null },
            include: { current_version: true, placements: true, _count: { select: { versions: true } } },
        })
        if (!document) {
            throw new NotFoundException(
                new ErrorDto(ErrorCodeEnum.DOCUMENT_NOT_FOUND, 'Not Found', 404, 'Document not found')
            )
        }
        return document
    }

    private mapForActor(document: DocumentWithRelations, actor: User): DocumentDto {
        const canManage = this.accessPolicy.canManagePlacements(actor, document.placements)
        const visiblePlacements = this.accessPolicy.filterPlacements(actor, document.placements)
        return mapDocumentToDto({ ...document, placements: visiblePlacements }, canManage)
    }

    private async prepareFile(file: UploadedFile | undefined): Promise<PreparedFile> {
        if (!file)
            throw new BadRequestException(
                new ErrorDto(ErrorCodeEnum.DOCUMENT_FILE_REQUIRED, 'Bad Request', 400, 'Document file is required')
            )
        if (!validateDocumentSize(file.size, this.maxFileSizeBytes)) {
            await this.removeTempFile(file.path)
            throw new BadRequestException(
                new ErrorDto(ErrorCodeEnum.DOCUMENT_FILE_TOO_LARGE, 'Bad Request', 400, 'Document file is too large')
            )
        }
        const originalFilename = normalizeOriginalFilename(file.originalname?.trim() || '')
        if (
            !originalFilename ||
            /[\u0000-\u001F\u007F\\/]/u.test(originalFilename) ||
            originalFilename.includes('..')
        ) {
            await this.removeTempFile(file.path)
            throw new BadRequestException(
                new ErrorDto(
                    ErrorCodeEnum.DOCUMENT_FILENAME_INVALID,
                    'Bad Request',
                    400,
                    'Document filename is invalid'
                )
            )
        }
        const extension = getDocumentExtension(originalFilename)
        const allowedMimeTypes = ALLOWED_DOCUMENT_MIME_TYPES[extension]
        if (!allowedMimeTypes) {
            await this.removeTempFile(file.path)
            throw new BadRequestException(
                new ErrorDto(
                    ErrorCodeEnum.DOCUMENT_EXTENSION_NOT_ALLOWED,
                    'Bad Request',
                    400,
                    'Document extension is not allowed'
                )
            )
        }
        if (!allowedMimeTypes?.includes(file.mimetype.toLowerCase())) {
            await this.removeTempFile(file.path)
            throw new BadRequestException(
                new ErrorDto(
                    ErrorCodeEnum.DOCUMENT_MIME_NOT_ALLOWED,
                    'Bad Request',
                    400,
                    'Document MIME type is not allowed'
                )
            )
        }
        const signature = await this.readSignature(file.path)
        if (!matchesDocumentSignature(extension, signature)) {
            await this.removeTempFile(file.path)
            throw new BadRequestException(
                new ErrorDto(
                    ErrorCodeEnum.DOCUMENT_SIGNATURE_MISMATCH,
                    'Bad Request',
                    400,
                    'Document signature does not match its type'
                )
            )
        }
        const hash = createHash('sha256')
        await pipeline(createReadStream(file.path), hash)
        return {
            extension,
            mimeType: file.mimetype.toLowerCase(),
            sizeBytes: file.size,
            sha256: hash.digest('hex'),
            originalFilename,
        }
    }

    private async readSignature(filePath: string): Promise<Buffer> {
        const handle = await open(filePath, 'r')
        try {
            const buffer = Buffer.alloc(16)
            const result = await handle.read(buffer, 0, buffer.length, 0)
            return buffer.subarray(0, result.bytesRead)
        } finally {
            await handle.close()
        }
    }

    private createStorageKey(extension: string): string {
        const random = randomBytes(32).toString('hex')
        return `${random.slice(0, 2)}/${random}${extension ? `.${extension}` : ''}`
    }

    private async removeTempFile(filePath?: string) {
        if (filePath) await rm(filePath, { force: true }).catch(() => undefined)
    }

    private documentOrderBy(query: DocumentQueryDto, placementKey?: string): Prisma.DocumentOrderByWithRelationInput[] {
        const direction = query.sortDirection ?? DocumentSortDirection.DESC
        const tie: Prisma.DocumentOrderByWithRelationInput = { id: 'asc' }
        switch (query.sortBy ?? DocumentSortBy.UPDATED_AT) {
            case DocumentSortBy.CREATED_AT:
                return [{ created_at: direction }, tie]
            case DocumentSortBy.TITLE:
                return [{ title: direction }, tie]
            case DocumentSortBy.DOCUMENT_DATE:
                return [{ document_date: { sort: direction, nulls: 'last' } }, tie]
            case DocumentSortBy.PLACEMENT_ORDER:
                return placementKey ? [{ updated_at: direction }, tie] : [{ updated_at: direction }, tie]
            default:
                return [{ updated_at: direction }, tie]
        }
    }

    private toGroupKey(group: string): 'gia-9' | 'gia-11' | 'gia' | 'quality' | 'regional' | 'about' {
        const map = {
            GIA_9: 'gia-9',
            GIA_11: 'gia-11',
            GIA: 'gia',
            QUALITY: 'quality',
            REGIONAL: 'regional',
            ABOUT: 'about',
        } as const
        return map[group as keyof typeof map]
    }
}
