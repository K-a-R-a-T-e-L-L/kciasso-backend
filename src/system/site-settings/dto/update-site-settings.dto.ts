import { Transform } from 'class-transformer'
import { ArrayMaxSize, ArrayMinSize, IsEmail, IsIn, IsNotEmpty, IsOptional, Length, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { HOME_SECTION_KEYS } from '../site-settings.constants'

@ValidatorConstraint({ name: 'uniqueArray', async: false })
class UniqueArrayConstraint {
    validate(value: unknown) {
        return Array.isArray(value) && new Set(value).size === value.length
    }

    defaultMessage() {
        return 'homeSectionsOrder must contain unique section keys'
    }
}

export function normalizePhoneForValidation(value: string) {
    return value.replace(/\u00a0/g, ' ').replace(/[()\s-]/g, '')
}

@ValidatorConstraint({ name: 'isRussianPhoneNumber', async: false })
class RussianPhoneNumberConstraint implements ValidatorConstraintInterface {
    validate(value: unknown) {
        if (typeof value !== 'string') return false

        const normalized = normalizePhoneForValidation(value)
        return /^8\d{10}$/.test(normalized) || /^7\d{10}$/.test(normalized) || /^\+7\d{10}$/.test(normalized)
    }

    defaultMessage(args: ValidationArguments) {
        return `${args.property}|isRussianPhoneNumber`
    }
}

function trimString({ value }: { value: unknown }) {
    return typeof value === 'string' ? value.replace(/\u00a0/g, ' ').trim() : value
}

export class UpdateSiteSettingsDto {
    @ApiPropertyOptional({ enum: HOME_SECTION_KEYS, isArray: true })
    @IsOptional()
    @ArrayMinSize(HOME_SECTION_KEYS.length)
    @ArrayMaxSize(HOME_SECTION_KEYS.length)
    @IsIn(HOME_SECTION_KEYS, { each: true })
    @Validate(UniqueArrayConstraint)
    homeSectionsOrder?: string[]

    @ApiPropertyOptional()
    @IsOptional()
    @Transform(trimString)
    @IsNotEmpty()
    @Validate(RussianPhoneNumberConstraint)
    giaHotlinePhone?: string

    @ApiPropertyOptional()
    @IsOptional()
    @Transform(trimString)
    @IsNotEmpty()
    @Validate(RussianPhoneNumberConstraint)
    informationPhone?: string

    @ApiPropertyOptional()
    @IsOptional()
    @Transform(trimString)
    @IsNotEmpty()
    @Validate(RussianPhoneNumberConstraint)
    egeTrustPhone?: string

    @ApiPropertyOptional()
    @IsOptional()
    @Transform(trimString)
    @IsNotEmpty()
    @Length(5, 254)
    @IsEmail()
    email?: string
}
