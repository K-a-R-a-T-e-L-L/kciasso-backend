import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { DocumentGroup, DocumentsAccessMode } from '@prisma/client'
import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator'

import { AdminRole } from './admin-access.dto'

export class CreateAdminUserDto {
    @ApiProperty()
    @IsString()
    @MinLength(1)
    name: string

    @ApiProperty()
    @IsEmail()
    email: string

    @ApiProperty()
    @IsString()
    @MinLength(8)
    password: string

    @ApiProperty({ enum: AdminRole })
    @IsEnum(AdminRole)
    role: AdminRole

    @ApiPropertyOptional({ default: true })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean

    @ApiPropertyOptional({ default: false })
    @IsBoolean()
    @IsOptional()
    canManageSiteSettings?: boolean

    @ApiPropertyOptional({ default: false })
    @IsBoolean()
    @IsOptional()
    canManageNews?: boolean

    @ApiProperty({ enum: DocumentsAccessMode })
    @IsEnum(DocumentsAccessMode)
    documentsAccessMode: DocumentsAccessMode

    @ApiPropertyOptional({ enum: DocumentGroup, isArray: true })
    @IsArray()
    @IsEnum(DocumentGroup, { each: true })
    @IsOptional()
    documentGroups?: DocumentGroup[]
}
