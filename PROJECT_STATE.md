# KCIASSO — PROJECT_STATE

Last updated: 2026-07-29, Stage M9.2 Part 2B.

## Logical project

- Frontend: `D:\Desktop\dev\web\orders\kciasso\kciasso-frontend`
- Backend: `D:\Desktop\dev\web\orders\kciasso\kciasso-backend`
- Canonical report: `D:\Desktop\dev\web\orders\kciasso\kciasso-backend\отчёт.txt`

## Stack and architecture

- Frontend: Next.js 16 App Router, React 19, TypeScript, Mantine 8, dnd-kit, Kubb and Playwright.
- Backend: NestJS 10, Prisma 5, PostgreSQL, Swagger/OpenAPI and JWT sessions.
- Protected admin routes use server-side authorization; generated Kubb clients are consumed through explicit adapters and proxy routes.
- Page layout runtime/API use `PageLayout`, `SectionDefinition` and `PageSectionPlacement`.
- Section types are `PAGE_SYSTEM`, `GLOBAL_SYSTEM`, `PAGE_CUSTOM_HTML` and `GLOBAL_CUSTOM_HTML`.
- Legacy `PageSection`, `GlobalHtmlSection` and `GlobalHtmlSlot` remain preserved only as backfill sources pending separate cleanup acceptance.
- Global custom content is stored once; each of the 13 registry pages owns an independently sortable/visible placement.
- `global.contacts` is one immutable `GLOBAL_SYSTEM` definition, placed last by default on every registry page.
- Public pages consume the generated definition/placement contract through one explicit adapter and one ordered `PublicPageSections` runtime.
- System rendering uses the exact 30-key backend registry map; route-owned server nodes are supplied through one typed provider. Custom HTML uses sandboxed `srcDoc` iframes.
- Contacts are rendered only by the `global.contacts` placement; `MainLayout` no longer inserts a contact section.

## Main routes and modules

- Page API: public `/api/public/pages/:pageKey/layout`; admin `/api/admin/pages/**`.
- Pages implementation: `src/system/pages`; registry: `src/system/pages/pages.registry.ts`.
- Backfill implementation: `src/system/pages/pages-backfill.service.ts`; CLI: `scripts/pages-backfill-section-definitions.ts`.
- Admin frontend: `/admin/pages`, page layout editor and global HTML definition editor.
- Public renderer: `src/widgets/pages/PublicPageSections`; all 13 registry routes use it directly or through the thin `OrderedPublicPage` wrapper.

## Database and generated contracts

- Confirmed local development DB: PostgreSQL `localhost/kciasso_backend_dev`, schema `public`, environment `development`.
- Fifteen additive migrations are current, including the two M9.2 definition/placement migrations.
- Controlled M9.2 backfill was applied locally; repeated apply is a true no-op with unchanged page revisions.
- Generated paths: backend `src/.generated/prisma`; frontend `src/shared/api/generated`. Never edit generated output manually.
- Pages Swagger success and documented error responses are typed; generated PagesController success/error `any` counts are both zero.

## Concurrency and safety decisions

- Page-local mutations reserve the expected layout revision conditionally inside the same interactive transaction.
- Global create/update/delete use transaction-scoped row locks; create/delete require all 13 layouts and delete requires all 13 placements.
- E2E database reset is guarded to local hosts, database names ending `_e2e`, and never `kciasso_backend_dev`.
- Dirty worktrees are intentional. Do not reset, restore, clean, stash, drop, truncate, db-push, commit or deploy without explicit authorization.

## Commands and verification

- Backend: `npx prisma validate`, `npx prisma generate`, `npx prisma migrate status`, `npm run lint -- --no-fix`, `npm test -- --runInBand`, `npm run test:e2e -- --runInBand`, `npm run build`.
- Frontend: `npx tsc --noEmit`, `npm run lint`, `npm run check:admin-ui`, `npm run test:unit`, `npm run build`.
- Kubb: start an isolated backend, verify `/api/docs-json`, then run `npm run api:generate`.
- Latest backend verification: 11 unit suites / 59 tests; pages unit 16; 16 E2E suites / 136 tests, including concurrency 15, contract 24 and backfill 4; build/lint/diff check pass.
- Latest frontend verification: TypeScript, lint and production build pass; 24 unit files / 63 tests and Part 2B Playwright 2/2 pass.
- Latest Part 2B backend read-only regression: Prisma validate/status, lint, 11 unit suites / 59 tests and build pass. Full unchanged Part 1 E2E baseline remains 16 suites / 136 tests.

## Codebase Memory

- Fast non-persistent indexes refreshed after M9.2 Part 1 FINAL.
- Backend: 1,369 nodes / 3,549 edges.
- Frontend: 1,353 nodes / 2,724 edges.

## Current next task

M9.2 Part 2B is READY. Begin the next Part 2 admin/visual stage only through a separate explicit task. Do not start legacy cleanup until full frontend/runtime acceptance; the six preserved home custom placements require an explicit data-owner decision if their iframe heights should change.
