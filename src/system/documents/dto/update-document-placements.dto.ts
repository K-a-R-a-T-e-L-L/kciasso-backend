import { ApiProperty } from '@nestjs/swagger'
import { ArrayNotEmpty, ArrayUnique, IsArray, IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class UpdateDocumentPlacementsDto {
    @ApiProperty({ type: String, isArray: true })
    @IsArray()
    @ArrayNotEmpty()
    @ArrayUnique()
    @IsString({ each: true })
    @IsNotEmpty({ each: true })
    @MaxLength(160, { each: true })
    placementKeys!: string[]
}
