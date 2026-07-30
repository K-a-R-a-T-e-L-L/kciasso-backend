import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class CreatePageSectionDto {
    @ApiProperty() @IsString() @MaxLength(200) name: string
    @ApiProperty() @IsString() @MaxLength(512 * 1024) html: string
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(256 * 1024) css?: string
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(256 * 1024) javascript?: string
    @ApiPropertyOptional({ minimum: 120, maximum: 4000 })
    @IsOptional()
    @IsInt()
    @Min(120)
    @Max(4000)
    iframeHeight?: number
    @ApiProperty() @IsInt() @Min(0) expectedRevision: number
}
