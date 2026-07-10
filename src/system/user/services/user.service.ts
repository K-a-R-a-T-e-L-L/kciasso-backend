import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import * as bcryptjs from 'bcryptjs'
import { randomUUID } from 'crypto'
import { Section, User, UserSectionPermission } from '@prisma/client'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

import { CreateUserDto, UpdateUserDto } from '../../../.generated/prisma'
import { ErrorCodeEnum } from '../../../_helpers/enums/validator/error.code.enum'
import { ErrorDto } from '../../../_helpers/errors/error.dto'
import { PrismaService } from '../../../prisma/prisma.service'
import { AdminSectionDto } from '../dto/admin-section.dto'
import { CreateAdminUserDto } from '../dto/create-admin-user.dto'
import { AdminUserUpdateDto } from '../dto/admin-user-update.dto'
import { AdminUserDto } from '../dto/admin-user.dto'
import { CurrentUserDto } from '../dto/current-user.dto'
import { UpdateUserPermissionsDto } from '../dto/update-user-permissions.dto'
import { UserPermissionsDto } from '../dto/user-permissions.dto'
import { UserAuthDto } from '../dto/user-auth.dto'

type UserWithPermissions = User & {
    section_permissions: (UserSectionPermission & {
        section: Section
    })[]
}

@Injectable()
export class UserService {
    private readonly saltRounds = 10

    constructor(
        private jwtService: JwtService,
        private configService: ConfigService,
        private prisma: PrismaService
    ) {}

    get headers() {
        return {
            authorization: 'Bearer ' + this.configService.getOrThrow<string>('SERVICE_TOKEN_AUTH'),
        }
    }

    async authenticate(dto: UserAuthDto) {
        const user = await this.prisma.user.findFirst({
            where: {
                email: dto.email,
                deleted_at: null,
            },
        })

        if (!user) {
            throw new BadRequestException(new ErrorDto(ErrorCodeEnum.AUTH_FAIL))
        }

        const isPasswordValid = await bcryptjs.compare(dto.password, user.password)
        if (!isPasswordValid) {
            throw new BadRequestException(new ErrorDto(ErrorCodeEnum.AUTH_FAIL))
        }

        return await this.generateToken(user)
    }

    async register(dto: CreateUserDto) {
        const hashedPassword = await this.hashPassword(dto.password)

        const user = await this.prisma.user.create({
            data: {
                name: dto.name,
                email: dto.email,
                password: hashedPassword,
            },
        })

        if (!user) {
            throw new BadRequestException(new ErrorDto(ErrorCodeEnum.AUTH_FAIL))
        }

        return await this.generateToken(user)
    }

    async generateToken(user: User) {
        const token = this.jwtService.sign(
            {
                sub: user.id,
                jti: randomUUID(),
            },
            { expiresIn: this.configService.get('JWT_EXPIRES'), secret: this.configService.get('JWT_SECRET') }
        )

        const userVerify = this.jwtService.verify(token, {
            secret: this.configService.get('JWT_SECRET'),
        })

        const session = await this.prisma.session.create({
            data: {
                token,
                expire_at: new Date(userVerify.exp * 1000),
                user_id: user.id,
            },
        })
        return session
    }

    public async findSessionByToken(token: string) {
        return this.prisma.session.findFirst({
            where: {
                token,
                expire_at: {
                    gt: new Date(),
                },
            },
            include: {
                user: true,
            },
        })
    }

    public async update(user: User, dto: UpdateUserDto) {
        const data = {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.email !== undefined ? { email: dto.email } : {}),
            ...(dto.password !== undefined ? { password: await this.hashPassword(dto.password) } : {}),
        }

        const updatedUser = await this.prisma.user.update({
            where: { id: user.id },
            data,
        })

        return this.toCurrentUserDto({
            ...updatedUser,
            section_permissions: await this.findUserPermissionRelations(updatedUser.id),
        })
    }

    async getCurrentUserProfile(userId: number): Promise<CurrentUserDto> {
        const user = await this.findUserWithPermissionsOrThrow(userId)
        return this.toCurrentUserDto(user)
    }

    async getAdminUsers(): Promise<AdminUserDto[]> {
        const users = await this.prisma.user.findMany({
            where: {
                deleted_at: null,
            },
            orderBy: {
                id: 'asc',
            },
            include: {
                section_permissions: {
                    include: {
                        section: true,
                    },
                },
            },
        })

        return users.map(user => this.toAdminUserDto(user))
    }

    async getAdminUserById(userId: number): Promise<AdminUserDto> {
        const user = await this.findUserWithPermissionsOrThrow(userId)
        return this.toAdminUserDto(user)
    }

    async createAdminUser(dto: CreateAdminUserDto): Promise<AdminUserDto> {
        const uniqueSectionIds = Array.from(new Set(dto.sectionIds ?? []))
        const sections = await this.getSectionsBySectionIds(uniqueSectionIds)
        const hashedPassword = await this.hashPassword(dto.password)

        try {
            const createdUser = await this.prisma.$transaction(async transaction => {
                const user = await transaction.user.create({
                    data: {
                        name: dto.name.trim(),
                        email: dto.email.trim(),
                        password: hashedPassword,
                        is_super_admin: dto.isSuperAdmin ?? false,
                    },
                })

                if (sections.length > 0) {
                    await transaction.userSectionPermission.createMany({
                        data: sections.map(section => ({
                            user_id: user.id,
                            section_id: section.id,
                        })),
                    })
                }

                return transaction.user.findUniqueOrThrow({
                    where: {
                        id: user.id,
                    },
                    include: {
                        section_permissions: {
                            include: {
                                section: true,
                            },
                        },
                    },
                })
            })

            return this.toAdminUserDto(createdUser)
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
        await this.ensureUserExists(userId)

        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: {
                ...(dto.name !== undefined ? { name: dto.name } : {}),
                ...(dto.email !== undefined ? { email: dto.email } : {}),
                ...(dto.isSuperAdmin !== undefined ? { is_super_admin: dto.isSuperAdmin } : {}),
            },
            include: {
                section_permissions: {
                    include: {
                        section: true,
                    },
                },
            },
        })

        return this.toAdminUserDto(updatedUser)
    }

    async deleteAdminUser(userId: number, actorUserId: number): Promise<AdminUserDto> {
        const targetUser = await this.findUserWithPermissionsOrThrow(userId)

        if (targetUser.id === actorUserId) {
            throw new BadRequestException(
                new ErrorDto(ErrorCodeEnum.INVALID_QUERY_STRING, 'Bad Request', 400, 'You cannot delete your own account')
            )
        }

        if (targetUser.is_super_admin) {
            const activeSuperAdminsCount = await this.prisma.user.count({
                where: {
                    is_super_admin: true,
                    deleted_at: null,
                },
            })

            if (activeSuperAdminsCount <= 1) {
                throw new BadRequestException(
                    new ErrorDto(
                        ErrorCodeEnum.INVALID_QUERY_STRING,
                        'Bad Request',
                        400,
                        'You cannot delete the last super admin'
                    )
                )
            }
        }

        const deletedUser = await this.prisma.$transaction(async transaction => {
            await transaction.session.updateMany({
                where: {
                    user_id: userId,
                    deleted_at: null,
                },
                data: {
                    deleted_at: new Date(),
                    expire_at: new Date(),
                },
            })

            await transaction.userSectionPermission.deleteMany({
                where: {
                    user_id: userId,
                },
            })

            await transaction.news.updateMany({
                where: {
                    author_id: userId,
                },
                data: {
                    author_id: null,
                },
            })

            const archivedEmail = `${targetUser.email}__deleted__${targetUser.id}`
            const archivedName = `${targetUser.name} (deleted)`

            await transaction.user.update({
                where: {
                    id: userId,
                },
                data: {
                    name: archivedName,
                    email: archivedEmail,
                    deleted_at: new Date(),
                },
            })

            return {
                ...targetUser,
                name: archivedName,
                email: archivedEmail,
                section_permissions: [],
            }
        })

        return this.toAdminUserDto(deletedUser)
    }

    async getUserPermissions(userId: number): Promise<UserPermissionsDto> {
        const user = await this.findUserWithPermissionsOrThrow(userId)

        return {
            user: this.toAdminUserDto(user),
            permissions: this.extractSectionIds(user.section_permissions),
        }
    }

    async updateUserPermissions(userId: number, dto: UpdateUserPermissionsDto): Promise<UserPermissionsDto> {
        await this.ensureUserExists(userId)

        const uniqueSectionIds = Array.from(new Set(dto.sectionIds))
        const sections = await this.getSectionsBySectionIds(uniqueSectionIds)

        await this.prisma.$transaction(async transaction => {
            await transaction.userSectionPermission.deleteMany({
                where: {
                    user_id: userId,
                },
            })

            if (sections.length > 0) {
                await transaction.userSectionPermission.createMany({
                    data: sections.map(section => ({
                        user_id: userId,
                        section_id: section.id,
                    })),
                })
            }
        })

        return this.getUserPermissions(userId)
    }

    async getAdminSections(): Promise<AdminSectionDto[]> {
        const sections = await this.prisma.section.findMany({
            where: {
                deleted_at: null,
            },
            orderBy: [{ sort_order: 'asc' }, { title: 'asc' }],
        })

        return sections.map(section => this.toAdminSectionDto(section))
    }

    async hasSectionPermission(userId: number, requiredSectionId: string): Promise<boolean> {
        const permission = await this.prisma.userSectionPermission.findFirst({
            where: {
                user_id: userId,
                section: {
                    section_id: requiredSectionId,
                },
            },
            select: {
                id: true,
            },
        })

        return Boolean(permission)
    }

    async hashPassword(password: string): Promise<string> {
        return bcryptjs.hash(password, this.saltRounds)
    }

    private async getSectionsBySectionIds(sectionIds: string[]) {
        if (sectionIds.length === 0) {
            return []
        }

        const sections = await this.prisma.section.findMany({
            where: {
                section_id: {
                    in: sectionIds,
                },
            },
            select: {
                id: true,
                section_id: true,
            },
        })

        if (sections.length !== sectionIds.length) {
            const existingIds = new Set(sections.map(section => section.section_id))
            const missingIds = sectionIds.filter(sectionId => !existingIds.has(sectionId))

            throw new NotFoundException(
                new ErrorDto(
                    ErrorCodeEnum.ENTITY_NOT_FOUND,
                    'Not Found',
                    404,
                    `Unknown sectionIds: ${missingIds.join(', ')}`
                )
            )
        }

        return sections
    }

    private async findUserWithPermissionsOrThrow(userId: number): Promise<UserWithPermissions> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                section_permissions: {
                    include: {
                        section: true,
                    },
                },
            },
        })

        if (!user || user.deleted_at) {
            throw new NotFoundException(new ErrorDto(ErrorCodeEnum.ENTITY_NOT_FOUND, 'Not Found', 404, 'User not found'))
        }

        return user
    }

    private async ensureUserExists(userId: number): Promise<void> {
        const exists = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, deleted_at: true },
        })

        if (!exists || exists.deleted_at) {
            throw new NotFoundException(new ErrorDto(ErrorCodeEnum.ENTITY_NOT_FOUND, 'Not Found', 404, 'User not found'))
        }
    }

    private async findUserPermissionRelations(userId: number) {
        return this.prisma.userSectionPermission.findMany({
            where: {
                user_id: userId,
            },
            include: {
                section: true,
            },
        })
    }

    private toCurrentUserDto(user: UserWithPermissions): CurrentUserDto {
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            isSuperAdmin: user.is_super_admin,
            permissions: this.extractSectionIds(user.section_permissions),
        }
    }

    private toAdminUserDto(user: UserWithPermissions): AdminUserDto {
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            isSuperAdmin: user.is_super_admin,
            permissions: this.extractSectionIds(user.section_permissions),
        }
    }

    private toAdminSectionDto(section: Section): AdminSectionDto {
        return {
            id: section.id,
            sectionId: section.section_id,
            title: section.title,
            kind: section.kind,
            route: section.route,
            parentId: section.parent_id,
            order: section.sort_order,
            isEditable: section.is_editable,
        }
    }

    private extractSectionIds(permissions: (UserSectionPermission & { section: Section })[]): string[] {
        return permissions
            .map(permission => permission.section.section_id)
            .sort((left, right) => left.localeCompare(right))
    }
}
