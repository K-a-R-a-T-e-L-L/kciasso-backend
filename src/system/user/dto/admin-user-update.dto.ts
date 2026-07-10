import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

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

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isSuperAdmin?: boolean
}
