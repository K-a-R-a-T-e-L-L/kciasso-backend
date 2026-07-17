import { ApiPropertyOptional } from '@nestjs/swagger'
import { DocumentGroup, DocumentsAccessMode } from '@prisma/client'
import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator'

import { AdminRole } from './admin-access.dto'

export class AdminUserUpdateDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MinLength(1)
    name?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsEmail()
    email?: string

    @ApiPropertyOptional({ enum: AdminRole })
    @IsOptional()
    @IsEnum(AdminRole)
    role?: AdminRole

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isActive?: boolean

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    canManageSiteSettings?: boolean

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    canManageNews?: boolean

    @ApiPropertyOptional({ enum: DocumentsAccessMode })
    @IsOptional()
    @IsEnum(DocumentsAccessMode)
    documentsAccessMode?: DocumentsAccessMode

    @ApiPropertyOptional({ enum: DocumentGroup, isArray: true })
    @IsOptional()
    @IsArray()
    @IsEnum(DocumentGroup, { each: true })
    documentGroups?: DocumentGroup[]

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MinLength(8)
    password?: string
}
