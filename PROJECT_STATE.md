# KCIASSO — PROJECT_STATE

Last updated: 2026-07-18, Prisma Docker generation path fixed and backend build verified.

## Logical project

- Frontend: `D:\Desktop\dev\web\orders\kciasso-frontend`
- Backend: `D:\Desktop\dev\web\orders\kciasso-backend`
- Canonical report: `D:\Desktop\dev\web\orders\kciasso-backend\отчёт.txt`

## Stack and architecture

- Frontend: Next.js 16, React 19, TypeScript, App Router, SCSS Modules, Kubb.
- Backend: NestJS 10, Prisma 5, PostgreSQL, Swagger/OpenAPI and JWT sessions.
- Administrative access is stored directly on `User`: `role`, `is_active`, site/news capability flags, `documents_access_mode` and fixed `document_groups`.
- `UserSectionPermission` remains in the database only for migration compatibility and is not a runtime authorization source.
- Documents use one Document/versions/files model with fixed registry placements and quarantine-backed storage.
- News supports an external image URL or an owned JPG/PNG/WebP file up to 10 MB. Owned media is stored under `NEWS_MEDIA_ROOT` (`/app/storage/media/news` in containers) and exposed through an opaque storage key.

## Main authorization decisions

- Roles are `SUPER_ADMIN` and `ADMIN`; only `SUPER_ADMIN` can manage administrators.
- Public registration is removed. Administrator creation uses the protected super-admin endpoint.
- Inactive users cannot log in and existing sessions are rejected on every protected request.
- Site settings and news are independently controlled by capability flags.
- Document modes are `NONE`, `ALL` and `SELECTED_GROUPS`; an empty selected-groups array grants no document access.
- Fixed document groups: `GIA_9`, `GIA_11`, `GIA`, `QUALITY`, `REGIONAL`, `ABOUT`.
- Mixed-scope documents are visible only in an allowed placement with `canManage: false`; management endpoints return 403, while reorder within the allowed placement remains available.
- The last active `SUPER_ADMIN` is transactionally protected from deletion, deactivation and demotion.
- The “Полный доступ к контенту” preset is a frontend convenience and does not grant user management.

## Main routes and data

- Public API is under `/api/public/**`; administrative API is under `/api/admin/**`; login/session routes are under `/api/user/**`.
- News media upload/removal is under `/api/admin/news/media`; public owned media is streamed under `/api/public/news/media/:key`.
- Documents use versioned files, fixed registry placements and version-pinned share links. Main files remain in persistent `storage/documents`; temporary uploads use `storage/tmp`.
- Frontend public routes include home, news, GIA, education quality, resources and centre pages; administration is under `/admin/**`.
- Admin document placement replacement is `PUT /api/admin/documents/:id/placements`; complete-list reorder is `PATCH /api/admin/document-placements/reorder`.

## Commands and generated paths

- Frontend checks: `npm run test:unit`, `npm run test:browser -- --workers=1`, `npm run lint`, `npm run build`.
- Backend checks: `npx prisma generate`, `npm test -- --runInBand`, `npm run test:e2e`, `npm run build`.
- Backend production start: `npm run start:container`; seed is controlled by `RUN_SEED_ON_BOOT=true`.
- Generated paths: frontend Kubb client under `src/shared/api/generated`; backend Prisma DTOs under `src/.generated/prisma`; Prisma Client under `node_modules/.prisma/client`. Do not edit generated output manually.

## Verification

- Frontend unit tests: 12 files, 41/41 passed; lint and production build passed.
- Backend unit tests: 5 suites, 30/30 passed; E2E: 10 suites, 85/85 passed; production build passed.
- Non-fixing ESLint for all changed backend TypeScript files passed.
- Full backend ESLint still reports 19 pre-existing formatting issues in unrelated site-settings/error DTO files.
- Placement selector browser acceptance passed at 1366×768 and 390×844: wheel/programmatic scrolling, last item visibility, fixed footer, body lock restoration and no horizontal overflow.
- Backend `npx prisma generate`, `npm run build` and unit tests pass after switching Prisma Client output to the standard `.prisma/client` path. Clean `npm ci` copy also generates and builds successfully.

## Constraints and known risks

- Do not manually edit generated Kubb/Prisma files.
- Do not run destructive checks against production DB or storage.
- Main storage/uploads and user processes must remain untouched.
- Deploy must apply migration `20260716230000_simple_admin_permissions` before the updated backend serves traffic.
- CI Docker build must be rerun after the Prisma generator-path fix; local Docker daemon was unavailable during this verification.
- Legacy `UserSectionPermission` can be removed only in a later compatibility-breaking migration after deployment validation.
- Perform manual browser acceptance of Users and News upload when an appropriate runtime is available.

## Current next task

Review and commit the intentional frontend/backend changes, deploy the additive migration and both applications, then perform the remaining Users/News browser acceptance against the deployed environment.

## Codebase Memory

- Frontend index refreshed 2026-07-16: 2197 nodes / 4615 edges, `persistence=false`, no repository artifact.
- Backend index refreshed 2026-07-16: 1013 nodes / 2508 edges, `persistence=false`, no repository artifact.
