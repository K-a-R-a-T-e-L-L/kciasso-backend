import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'

import { PublicationSweepService } from './publication-sweep.service'
import { PrismaModule } from '../../prisma/prisma.module'

@Module({ imports: [PrismaModule, ScheduleModule.forRoot()], providers: [PublicationSweepService] })
export class PublicationModule {}
