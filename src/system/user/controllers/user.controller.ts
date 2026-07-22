import {
    Body,
    Controller,
    Delete,
    Get,
    HttpException,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Req,
    Res,
} from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Request, Response } from 'express'

import { Session, UpdateUserDto, User } from '../../../.generated/prisma'
import { UserAuth, UserAuthType } from '../../../_helpers/decorators/auth.helpers'
import { ErrorDto } from '../../../_helpers/errors/error.dto'
import { UserDockPost, UserDockPut } from '../../../_helpers/swagger/user.swagger.helper'
import { RequireSuperAdmin } from '../decorators/require-super-admin.decorator'
import { UserDecorator } from '../decorators/user.decorator'
import { AdminUserUpdateDto } from '../dto/admin-user-update.dto'
import { AdminUserDto } from '../dto/admin-user.dto'
import { CreateAdminUserDto } from '../dto/create-admin-user.dto'
import { CurrentUserDto } from '../dto/current-user.dto'
import { UserAuthDto } from '../dto/user-auth.dto'
import { UserService } from '../services/user.service'

@Controller('user')
@ApiTags('Users')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @UserDockPost('authenticate', UserAuthType.NOT_AUTH, UserAuthDto, Session)
    async authenticate(
        @Body() dto: UserAuthDto,
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response
    ) {
        try {
            return await this.userService.authenticate(dto, request.ip || 'unknown')
        } catch (error) {
            if (error instanceof HttpException && error.getStatus() === 429) {
                const body = error.getResponse() as { retryAfter?: number }
                if (body.retryAfter) response.setHeader('Retry-After', String(body.retryAfter))
            }
            throw error
        }
    }

    @Get('')
    @UserAuth(UserAuthType.USER)
    @ApiOperation({ summary: 'Get current authenticated user' })
    @ApiResponse({ status: 200, type: CurrentUserDto })
    @ApiResponse({ status: 400, type: ErrorDto })
    async get(@UserDecorator() user: User) {
        return this.userService.getCurrentUserProfile(user.id)
    }

    @Get('me')
    @UserAuth(UserAuthType.USER)
    @ApiOperation({ summary: 'Get current authenticated user with permissions' })
    @ApiResponse({ status: 200, type: CurrentUserDto })
    @ApiResponse({ status: 400, type: ErrorDto })
    async me(@UserDecorator() user: User) {
        return this.userService.getCurrentUserProfile(user.id)
    }

    @UserDockPut('', UserAuthType.USER, UpdateUserDto, CurrentUserDto)
    async update(@UserDecorator() user: User, @Body() dto: UpdateUserDto) {
        return this.userService.update(user, dto)
    }

    @Get('admin/users')
    @RequireSuperAdmin()
    @ApiOperation({ summary: 'List users for super admin' })
    @ApiResponse({ status: 200, type: AdminUserDto, isArray: true })
    @ApiResponse({ status: 403, type: ErrorDto })
    async getAdminUsers() {
        return this.userService.getAdminUsers()
    }

    @Get('admin/users/:id')
    @RequireSuperAdmin()
    @ApiOperation({ summary: 'Get user details for super admin' })
    @ApiResponse({ status: 200, type: AdminUserDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    async getAdminUserById(@Param('id', ParseIntPipe) id: number) {
        return this.userService.getAdminUserById(id)
    }

    @Post('admin/users')
    @RequireSuperAdmin()
    @ApiOperation({ summary: 'Create user for super admin' })
    @ApiResponse({ status: 201, type: AdminUserDto })
    @ApiResponse({ status: 400, type: ErrorDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    async createAdminUser(@Body() dto: CreateAdminUserDto) {
        return this.userService.createAdminUser(dto)
    }

    @Patch('admin/users/:id')
    @RequireSuperAdmin()
    @ApiOperation({ summary: 'Update user for super admin' })
    @ApiResponse({ status: 200, type: AdminUserDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    async updateAdminUser(@Param('id', ParseIntPipe) id: number, @Body() dto: AdminUserUpdateDto) {
        return this.userService.updateAdminUser(id, dto)
    }

    @Delete('admin/users/:id')
    @RequireSuperAdmin()
    @ApiOperation({ summary: 'Soft-delete user for super admin' })
    @ApiResponse({ status: 200, type: AdminUserDto })
    @ApiResponse({ status: 400, type: ErrorDto })
    @ApiResponse({ status: 403, type: ErrorDto })
    @ApiResponse({ status: 404, type: ErrorDto })
    async deleteAdminUser(@Param('id', ParseIntPipe) id: number, @UserDecorator() user: User) {
        return this.userService.deleteAdminUser(id, user.id)
    }
}
