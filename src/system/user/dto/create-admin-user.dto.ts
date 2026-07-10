import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

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

    @ApiPropertyOptional()
    @IsBoolean()
    @IsOptional()
    isSuperAdmin?: boolean

    @ApiPropertyOptional({ type: [String] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    sectionIds?: string[]
}
