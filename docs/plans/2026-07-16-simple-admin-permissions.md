# KCIASSO simple admin permissions implementation plan

## Approved invariants

- Runtime authorization reads only the new `User` fields. Legacy `UserSectionPermission` remains in the schema but is never read or written.
- Roles are `SUPER_ADMIN` and `ADMIN`; storage continues to use `is_super_admin`.
- Document groups are the fixed Prisma enum values `GIA_9`, `GIA_11`, `GIA`, `QUALITY`, `REGIONAL`, `ABOUT`.
- `NONE` and `SELECTED_GROUPS` with no groups deny document access; `ALL` allows every group.
- Restricted mixed-scope documents are visible only through an allowed placement, expose only allowed placements, return `canManage: false`, and deny every resource mutation, versions/share-links/admin-file/delete operation.
- A deactivated user cannot authenticate or reuse an existing session.
- The last active super-admin cannot be deleted, deactivated, or demoted.
- `/user/register` is removed from the public API.

## Phase 1 — unfinished frontend regressions

1. Add failing tests in `src/widgets/admin/AdminDocumentsPanel/PlacementSelector.test.tsx` for one expanded group during broad search, body scroll lock restoration, and complete selection from the 31+ item group.
2. Change `PlacementSelector.client.tsx` to one `openGroupId` and filter its registry through an optional allowed-group list.
3. Change `PlacementSelector.module.scss` to the approved flex-column modal and independently scrolling central list.
4. Add a failing assertion in `AdminDocumentsPanel.test.tsx` that raw placement keys are absent.
5. Remove `sectionBadge` raw output from `AdminDocumentsPanel.client.tsx`; keep only `placementPageTitle`/`placementTitle` labels.
6. Add failing `AdminNewsForm` tests for file/URL modes, preview, replace/remove and input restrictions; implement the form UI and multipart server-action parsing.

Commands after each red/green cycle:

- `npm run test:unit -- PlacementSelector.test.tsx`
- `npm run test:unit -- AdminDocumentsPanel.test.tsx`
- `npm run test:unit -- AdminNewsForm.test.tsx`

## Phase 2 — news media backend

1. Add failing policy tests under `src/system/news/media/news-media.policy.spec.ts` for extension, MIME, JPEG/PNG/WebP signatures, SVG rejection and 10 MiB limit.
2. Add `NEWS_MEDIA_ROOT` to `.env.example`, `src/env.validation.ts`, `src/config/app.config.ts`, startup directory preparation and both Dockerfiles.
3. Add `news-media.storage.ts`, `news-media.policy.ts`, upload options, response DTO and public/admin media controllers under `src/system/news/media/**`.
4. Store random single-segment keys under `/app/storage/media/news`; expose only `/api/public/news/media/:key`; reject path traversal.
5. Add upload and delete-if-unreferenced endpoints protected by the news capability. `NewsService` deletes only its previous owned local URL after a successful replace/delete and never deletes external URLs or another news record's file.
6. Add E2E coverage to `test/news.e2e-spec.ts` for upload types, signatures, size, replacement, deletion, external URL preservation and cross-news ownership.

## Phase 3 — additive Prisma model and backend policy

1. Add failing permission E2E cases to `test/permissions.e2e-spec.ts` and document scope cases to document/share-link E2E suites.
2. Extend `prisma/schema.prisma` with `DocumentsAccessMode`, `DocumentGroup`, and additive User fields: `is_active`, `can_manage_site_settings`, `can_manage_news`, `documents_access_mode`, `document_groups`.
3. Create a new migration directory; never edit existing migrations. Defaults are inactive capabilities and `NONE`/empty groups.
4. Regenerate Prisma through `npx prisma generate`; do not hand-edit `src/.generated/prisma/**`.
5. Replace section-key DTOs with role/capability/document-access DTOs. Create/update uses one atomic payload with optional reset password.
6. Remove public registration and old section-permission endpoints from `UserController`; stop all reads/writes to `UserSectionPermission` in `UserService`.
7. Add `AdminCapabilityGuard`/decorator for news/settings and `DocumentAccessPolicy` for group validation, filtering and mixed-scope decisions. `UserGuard` throws 401 and verifies active state on every request.
8. Protect last active super-admin in one transaction for delete, deactivate and demotion; invalidate sessions on deactivation.
9. Pass the actor into every admin documents/share-links service method. Enforce allowed placement keys, filtered responses and `canManage` in service/policy code, not only controllers.
10. Change unknown placement keys/groups to 400; unauthorized remains 401 and denied access 403.

Verification:

- isolated PostgreSQL migration deploy;
- `npx prisma generate`;
- `npm test -- --runInBand`;
- targeted `npm run test:permissions`, news/documents/share links E2E against isolated DB;
- non-fixing ESLint invocation and `npm run build`.

## Phase 4 — frontend permissions and users

1. Regenerate Swagger/OpenAPI and Kubb with the running task-owned backend on temporary ports; generated Kubb is changed only by `npm run api:generate`.
2. Update `src/shared/admin/auth.ts`, protected layout and `/admin` redirect to use role/capability fields and document access mode.
3. Replace section-key Users UI with role, active state, optional password reset, module checkboxes, document access radio group, fixed group checkboxes, content-access preset and summary.
4. Filter the document placement registry and current placement selector using current-user document groups. Choose the first allowed placement when the requested placement is unavailable.
5. Render mixed-scope `canManage: false` as read-only and hide/disable all forbidden actions.
6. Add frontend unit tests for menu, direct-route helpers, Users preset/editor, allowed groups, mixed-scope read-only behavior and Russian errors.

## Phase 5 — acceptance, review and handoff

1. Run backend isolated migration, Prisma generation, unit/E2E, lint and build.
2. Run frontend Kubb generation verification, unit tests, lint and build.
3. Start only task-owned backend/frontend processes on free temporary ports, record exact PID/ports, and run Playwright desktop/mobile acceptance for modal wheel/touch behavior, menu/users editor/preset/direct URLs/media preview/placement filtering.
4. Stop exact task PIDs and browser processes; verify temporary ports and 3000/4000 state.
5. Review the full base-to-head diff against every approved invariant; fix blocking findings and rerun proof commands.
6. Refresh Codebase Memory for both affected repositories with `persistence=false`, update `PROJECT_STATE.md`, fully overwrite `отчёт.txt`, and leave a precise Git status/handoff.
