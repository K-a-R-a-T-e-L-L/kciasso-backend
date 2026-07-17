import { randomUUID } from 'crypto'

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { DocumentGroup, DocumentsAccessMode, User } from '@prisma/client'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import * as bcryptjs from 'bcryptjs'

import { UpdateUserDto } from '../../../.generated/prisma'
import { ErrorCodeEnum } from '../../../_helpers/enums/validator/error.code.enum'
import { ErrorDto } from '../../../_helpers/errors/error.dto'
import { PrismaService } from '../../../prisma/prisma.service'
import { AdminRole } from '../dto/admin-access.dto'
import { AdminUserUpdateDto } from '../dto/admin-user-update.dto'
import { AdminUserDto } from '../dto/admin-user.dto'
import { CreateAdminUserDto } from '../dto/create-admin-user.dto'
import { CurrentUserDto } from '../dto/current-user.dto'
import { UserAuthDto } from '../dto/user-auth.dto'

@Injectable()
export class UserService {
    private readonly saltRounds = 10

    constructor(
        private jwtService: JwtService,
        private configService: ConfigService,
        private prisma: PrismaService
    ) {}

    get headers() {
        return { authorization: 'Bearer ' + this.configService.getOrThrow<string>('SERVICE_TOKEN_AUTH') }
    }

    async authenticate(dto: UserAuthDto) {
        const user = await this.prisma.user.findFirst({
            where: { email: dto.email, deleted_at: null, is_active: true },
        })
        if (!user || !(await bcryptjs.compare(dto.password, user.password))) {
            throw new BadRequestException(new ErrorDto(ErrorCodeEnum.AUTH_FAIL))
        }
        return this.generateToken(user)
    }

    async generateToken(user: User) {
        const token = this.jwtService.sign(
            { sub: user.id, jti: randomUUID() },
            { expiresIn: this.configService.get('JWT_EXPIRES'), secret: this.configService.get('JWT_SECRET') }
        )
        const verified = this.jwtService.verify(token, { secret: this.configService.get('JWT_SECRET') })
        return this.prisma.session.create({
            data: { token, expire_at: new Date(verified.exp * 1000), user_id: user.id },
        })
    }

    findSessionByToken(token: string) {
        return this.prisma.session.findFirst({
            where: {
                token,
                deleted_at: null,
                expire_at: { gt: new Date() },
                user: { deleted_at: null, is_active: true },
            },
            include: { user: true },
        })
    }

    async update(user: User, dto: UpdateUserDto): Promise<CurrentUserDto> {
        const updated = await this.prisma.user.update({
            where: { id: user.id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name } : {}),
                ...(dto.email !== undefined ? { email: dto.email } : {}),
                ...(dto.password !== undefined ? { password: await this.hashPassword(dto.password) } : {}),
            },
        })
        return this.toCurrentUserDto(updated)
    }

    async getCurrentUserProfile(userId: number): Promise<CurrentUserDto> {
        return this.toCurrentUserDto(await this.findUserOrThrow(userId))
    }

    async getAdminUsers(): Promise<AdminUserDto[]> {
        const users = await this.prisma.user.findMany({ where: { deleted_at: null }, orderBy: { id: 'asc' } })
        return users.map(user => this.toAdminUserDto(user))
    }

    async getAdminUserById(userId: number): Promise<AdminUserDto> {
        return this.toAdminUserDto(await this.findUserOrThrow(userId))
    }

    async createAdminUser(dto: CreateAdminUserDto): Promise<AdminUserDto> {
        try {
            const user = await this.prisma.user.create({
                data: {
                    name: dto.name.trim(),
                    email: dto.email.trim(),
                    password: await this.hashPassword(dto.password),
                    is_super_admin: dto.role === AdminRole.SUPER_ADMIN,
                    is_active: dto.isActive ?? true,
                    can_manage_site_settings: dto.canManageSiteSettings ?? false,
                    can_manage_news: dto.canManageNews ?? false,
                    documents_access_mode: dto.documentsAccessMode,
                    document_groups: this.normalizeDocumentGroups(dto.documentsAccessMode, dto.documentGroups),
                },
            })
            return this.toAdminUserDto(user)
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new BadRequestException(
                    new ErrorDto(ErrorCodeEnum.EMAIL_ALREADY_IN_USE, 'Bad Request', 400, 'User email is already in use')
                )
            }
            throw error
        }
    }

    async updateAdminUser(userId: number, dto: AdminUserUpdateDto): Promise<AdminUserDto> {
        const hashedPassword = dto.password ? await this.hashPassword(dto.password) : undefined
        return this.prisma.$transaction(async transaction => {
            await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(780534091)')
            const target = await transaction.user.findUnique({ where: { id: userId } })
            if (!target || target.deleted_at) this.throwUserNotFound()

            const nextIsSuperAdmin = dto.role === undefined ? target.is_super_admin : dto.role === AdminRole.SUPER_ADMIN
            const nextIsActive = dto.isActive ?? target.is_active
            if (target.is_super_admin && target.is_active && (!nextIsSuperAdmin || !nextIsActive)) {
                await this.assertAnotherActiveSuperAdmin(transaction, userId)
            }

            const nextMode = dto.documentsAccessMode ?? target.documents_access_mode
            const nextGroups = dto.documentGroups ?? target.document_groups
            const updated = await transaction.user.update({
                where: { id: userId },
                data: {
                    ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                    ...(dto.email !== undefined ? { email: dto.email.trim() } : {}),
                    ...(hashedPassword ? { password: hashedPassword } : {}),
                    is_super_admin: nextIsSuperAdmin,
                    is_active: nextIsActive,
                    ...(dto.canManageSiteSettings !== undefined
                        ? { can_manage_site_settings: dto.canManageSiteSettings }
                        : {}),
                    ...(dto.canManageNews !== undefined ? { can_manage_news: dto.canManageNews } : {}),
                    documents_access_mode: nextMode,
                    document_groups: this.normalizeDocumentGroups(nextMode, nextGroups),
                },
            })
            if (target.is_active && !updated.is_active) {
                await transaction.session.updateMany({
                    where: { user_id: userId, deleted_at: null },
                    data: { deleted_at: new Date(), expire_at: new Date() },
                })
            }
            return this.toAdminUserDto(updated)
        })
    }

    async deleteAdminUser(userId: number, actorUserId: number): Promise<AdminUserDto> {
        if (userId === actorUserId) {
            throw new BadRequestException(
                new ErrorDto(
                    ErrorCodeEnum.INVALID_QUERY_STRING,
                    'Bad Request',
                    400,
                    'You cannot delete your own account'
                )
            )
        }
        return this.prisma.$transaction(async transaction => {
            await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(780534091)')
            const target = await transaction.user.findUnique({ where: { id: userId } })
            if (!target || target.deleted_at) this.throwUserNotFound()
            if (target.is_super_admin && target.is_active) await this.assertAnotherActiveSuperAdmin(transaction, userId)

            const now = new Date()
            await transaction.session.updateMany({
                where: { user_id: userId, deleted_at: null },
                data: { deleted_at: now, expire_at: now },
            })
            await transaction.news.updateMany({ where: { author_id: userId }, data: { author_id: null } })
            const updated = await transaction.user.update({
                where: { id: userId },
                data: {
                    name: `${target.name} (deleted)`,
                    email: `${target.email}__deleted__${target.id}`,
                    is_active: false,
                    deleted_at: now,
                },
            })
            return this.toAdminUserDto(updated)
        })
    }

    async hasCapability(userId: number, capability: 'news' | 'site-settings'): Promise<boolean> {
        const user = await this.prisma.user.findFirst({ where: { id: userId, deleted_at: null, is_active: true } })
        if (!user) return false
        if (user.is_super_admin) return true
        return capability === 'news' ? user.can_manage_news : user.can_manage_site_settings
    }

    async hashPassword(password: string): Promise<string> {
        return bcryptjs.hash(password, this.saltRounds)
    }

    private normalizeDocumentGroups(mode: DocumentsAccessMode, groups: DocumentGroup[] = []): DocumentGroup[] {
        return mode === DocumentsAccessMode.SELECTED_GROUPS ? Array.from(new Set(groups)) : []
    }

    private async findUserOrThrow(userId: number): Promise<User> {
        const user = await this.prisma.user.findUnique({ where: { id: userId } })
        if (!user || user.deleted_at) this.throwUserNotFound()
        return user
    }

    private throwUserNotFound(): never {
        throw new NotFoundException(new ErrorDto(ErrorCodeEnum.ENTITY_NOT_FOUND, 'Not Found', 404, 'User not found'))
    }

    private async assertAnotherActiveSuperAdmin(
        transaction: Pick<PrismaService, 'user'>,
        excludedUserId: number
    ): Promise<void> {
        const count = await transaction.user.count({
            where: { id: { not: excludedUserId }, is_super_admin: true, is_active: true, deleted_at: null },
        })
        if (count === 0) {
            throw new BadRequestException(
                new ErrorDto(
                    ErrorCodeEnum.INVALID_QUERY_STRING,
                    'Bad Request',
                    400,
                    'You cannot remove, deactivate, or demote the last active super admin'
                )
            )
        }
    }

    private accessDto(user: User) {
        return {
            role: user.is_super_admin ? AdminRole.SUPER_ADMIN : AdminRole.ADMIN,
            isActive: user.is_active,
            canManageSiteSettings: user.can_manage_site_settings,
            canManageNews: user.can_manage_news,
            documentsAccessMode: user.documents_access_mode,
            documentGroups: user.document_groups,
        }
    }

    private toCurrentUserDto(user: User): CurrentUserDto {
        return { id: user.id, name: user.name, email: user.email, ...this.accessDto(user) }
    }

    private toAdminUserDto(user: User): AdminUserDto {
        return { id: user.id, name: user.name, email: user.email, ...this.accessDto(user) }
    }
}
