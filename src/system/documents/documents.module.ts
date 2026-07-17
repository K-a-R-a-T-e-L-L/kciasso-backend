import { Module } from '@nestjs/common'

import { DocumentPlacementsController } from './controllers/document-placements.controller'
import {
    AdminDocumentShareLinkRevokeController,
    AdminDocumentShareLinksController,
    PublicDocumentShareLinksController,
} from './controllers/document-share-links.controller'
import { DocumentsController } from './controllers/documents.controller'
import { PublicDocumentsController } from './controllers/public-documents.controller'
import { DocumentAccessGuard } from './policies/document-access.guard'
import { DocumentAccessPolicy } from './policies/document-access.policy'
import { DocumentPlacementService } from './services/document-placement.service'
import { DocumentReconciliationService } from './services/document-reconciliation.service'
import { DocumentShareLinksService } from './services/document-share-links.service'
import { DocumentsService } from './services/documents.service'
import { DocumentStorage } from './storage/document-storage'
import { LocalDocumentStorage } from './storage/local-document-storage'
import { PrismaModule } from '../../prisma/prisma.module'
import { UserModule } from '../user/user.module'

@Module({
    imports: [PrismaModule, UserModule],
    controllers: [
        DocumentsController,
        DocumentPlacementsController,
        AdminDocumentShareLinksController,
        AdminDocumentShareLinkRevokeController,
        PublicDocumentShareLinksController,
        PublicDocumentsController,
    ],
    providers: [
        DocumentsService,
        DocumentAccessPolicy,
        DocumentAccessGuard,
        DocumentPlacementService,
        DocumentReconciliationService,
        DocumentShareLinksService,
        LocalDocumentStorage,
        { provide: DocumentStorage, useExisting: LocalDocumentStorage },
    ],
})
export class DocumentsModule {}
