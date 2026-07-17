import { DocumentGroup, DocumentsAccessMode } from '@prisma/client'

import { DocumentAccessPolicy } from './document-access.policy'

const admin = (overrides: Record<string, unknown> = {}) => ({
    is_super_admin: false,
    documents_access_mode: DocumentsAccessMode.NONE,
    document_groups: [] as DocumentGroup[],
    ...overrides,
})

describe('DocumentAccessPolicy', () => {
    const policy = new DocumentAccessPolicy()

    it('denies NONE and SELECTED_GROUPS with an empty list', () => {
        expect(policy.canAccessPlacement(admin(), 'gia-9.normative-documents')).toBe(false)
        expect(
            policy.canAccessPlacement(
                admin({ documents_access_mode: DocumentsAccessMode.SELECTED_GROUPS }),
                'gia-9.normative-documents'
            )
        ).toBe(false)
    })

    it('allows ALL and only selected fixed groups', () => {
        expect(
            policy.canAccessPlacement(admin({ documents_access_mode: DocumentsAccessMode.ALL }), 'about.obuchenie')
        ).toBe(true)
        const selected = admin({
            documents_access_mode: DocumentsAccessMode.SELECTED_GROUPS,
            document_groups: [DocumentGroup.GIA_9],
        })
        expect(policy.canAccessPlacement(selected, 'gia-9.normative-documents')).toBe(true)
        expect(policy.canAccessPlacement(selected, 'gia-11.normative-documents')).toBe(false)
    })

    it('marks mixed-scope documents read-only and hides forbidden placements', () => {
        const selected = admin({
            documents_access_mode: DocumentsAccessMode.SELECTED_GROUPS,
            document_groups: [DocumentGroup.GIA_9],
        })
        const placements = [{ section_key: 'gia-9.normative-documents' }, { section_key: 'gia-11.normative-documents' }]
        expect(policy.canManagePlacements(selected, placements)).toBe(false)
        expect(policy.filterPlacements(selected, placements)).toEqual([{ section_key: 'gia-9.normative-documents' }])
    })
})
