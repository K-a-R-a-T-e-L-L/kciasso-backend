import { ApiProperty } from '@nestjs/swagger'
import { DocumentGroup, DocumentsAccessMode } from '@prisma/client'

export enum AdminRole {
    SUPER_ADMIN = 'SUPER_ADMIN',
    ADMIN = 'ADMIN',
}

export class AdminAccessDto {
    @ApiProperty({ enum: AdminRole })
    role: AdminRole

    @ApiProperty()
    isActive: boolean

    @ApiProperty()
    canManageSiteSettings: boolean

    @ApiProperty()
    canManageNews: boolean

    @ApiProperty({ enum: DocumentsAccessMode })
    documentsAccessMode: DocumentsAccessMode

    @ApiProperty({ enum: DocumentGroup, isArray: true })
    documentGroups: DocumentGroup[]
}
