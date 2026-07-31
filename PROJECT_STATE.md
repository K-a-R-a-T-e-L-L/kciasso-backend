# KCIASSO — PROJECT_STATE

Last updated: 2026-07-30, Stage M9.2 Part 2D.

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
- `global.contacts` is one immutable `GLOBAL_SYSTEM` definition, placed last by default on every registry page except the full `about.contacts` page.
- Public pages consume the generated definition/placement contract through one explicit adapter and one ordered `PublicPageSections` runtime.
- System rendering uses the exact 31-key backend registry map; route-owned server nodes are supplied through one typed provider. Custom HTML uses sandboxed `srcDoc` iframes inside the shared public container.
- Contacts are rendered only by the `global.contacts` placement; `MainLayout` no longer inserts a contact section.

## Main routes and modules

- Page API: public `/api/public/pages/:pageKey/layout`; admin `/api/admin/pages/**`.
- Pages implementation: `src/system/pages`; registry: `src/system/pages/pages.registry.ts`.
- Backfill implementation: `src/system/pages/pages-backfill.service.ts`; CLI: `scripts/pages-backfill-section-definitions.ts`.
- Admin frontend: `/admin/pages`, page layout editor and global HTML definition editor.
- Admin page registry uses friendly 13-page cards; the editor keeps all four section types in one sortable list with handle-only pointer/touch/keyboard DnD, optimistic rollback/stale reload and lazy custom-HTML previews.
- Admin news query state is URL/server-owned (`page`, `limit`, `search`, generated `status`, `category`, generated `sort`); pagination supports 10/20/50/100 without post-pagination client filtering.
- Admin documents, publication controls, share links and news categories/forms use Mantine controls/modals; the admin source gate enforces zero legacy controls, native dialogs, Box-backed controls and scoped mojibake.
- Public renderer: `src/widgets/pages/PublicPageSections`; all 13 registry routes use it directly or through the thin `OrderedPublicPage` wrapper.
- Canonical GIA metadata lives in `src/shared/content/gia-sections.ts`; GIA-9 has five and GIA-11 seven independently managed root previews and matching child routes.
- GIA child routes fetch only the selected document section and render hero, selected content and contacts through the same public renderer.
- Home carousel and public custom HTML use the same 1180px shared container as normal public sections.

## Database and generated contracts

- Confirmed local development DB: PostgreSQL `localhost/kciasso_backend_dev`, schema `public`, environment `development`.
- Fifteen additive migrations are current, including the two M9.2 definition/placement migrations.
- Controlled M9.2 backfill was applied locally; repeated apply is a true no-op with unchanged page revisions.
- Part 2D local repair removed `about.contacts/global.contacts` and managed `gia-11.additional`, then materialized `gia-11.essay` and `gia-11.analytics`; custom rows were unchanged.
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
- Latest backend verification: Prisma validate/status, lint, build and diff check pass; 12 unit suites / 74 tests and 17 E2E suites / 149 tests pass.
- Latest frontend verification: TypeScript, lint, source gate, fresh task-API production build and diff check pass; 29 unit files / 103 tests pass.
- Part 2D Playwright acceptance covers 1440×900, 768×1024, 390×844 and 1920×1080; all 12 GIA and 13 quality child routes pass, with 11 screenshots in frontend `test-results`.

## Codebase Memory

- Fast indexes refreshed after M9.2 Part 2D with `persistence=false`; no repository artifacts were created.
- Backend: 1,381 nodes / 3,578 edges.
- Frontend: 1,421 nodes / 2,914 edges.

## Current next task

M9.2 Part 2D implementation and local acceptance are complete. Stop here until a separate explicit next-stage task. Do not start admin review, legacy table/column cleanup or deployment from this state.
