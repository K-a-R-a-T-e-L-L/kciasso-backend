import { ApiProperty } from '@nestjs/swagger'
import { IsEnum } from 'class-validator'

export enum NEWS_CATEGORY_MOVE_DIRECTION {
    UP = 'up',
    DOWN = 'down',
}

export class MoveNewsCategoryDto {
    @ApiProperty({ enum: NEWS_CATEGORY_MOVE_DIRECTION })
    @IsEnum(NEWS_CATEGORY_MOVE_DIRECTION)
    direction!: NEWS_CATEGORY_MOVE_DIRECTION
}
