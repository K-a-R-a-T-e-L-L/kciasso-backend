import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
export class CreateGlobalHtmlSectionDto {
    @ApiProperty() @IsString() @MaxLength(200) name: string
    @ApiProperty() @IsString() @MaxLength(512 * 1024) html: string
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(256 * 1024) css?: string
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(256 * 1024) javascript?: string
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(120) @Max(4000) iframeHeight?: number
}
export class UpdateGlobalHtmlSectionDto extends PartialType(CreateGlobalHtmlSectionDto) {
    @ApiProperty()
    @IsInt()
    @Min(1)
    expectedDefinitionRevision: number
}
