import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsInt, Min } from 'class-validator'

export class DeletePageSectionDto {
    @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) expectedRevision: number
}
export class TogglePageSectionDto {
    @ApiProperty() @IsBoolean() isVisible: boolean
    @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) expectedRevision: number
}
export class DeleteGlobalHtmlSectionDto {
    @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedDefinitionRevision: number
}
