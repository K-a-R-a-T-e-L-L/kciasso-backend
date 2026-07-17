# KCIASSO — PROJECT_STATE

Last updated: 2026-07-16, stale task runtime cleanup complete.

## Logical project

- Frontend: `D:\Desktop\dev\web\orders\kciasso-frontend`
- Backend: `D:\Desktop\dev\web\orders\kciasso-backend`
- Canonical report: `D:\Desktop\dev\web\orders\kciasso-backend\отчёт.txt`

## Stack and architecture

- Frontend: Next.js 16, React 19, TypeScript, App Router, SCSS Modules, Kubb.
- Backend: NestJS 10, Prisma 5, PostgreSQL, Swagger/OpenAPI, JWT and section permissions.
- Documents use one Document/versions/files model with fixed registry placements and quarantine-backed storage.

## Document contracts

- Admin create is multipart with `placementKeys[]`; list uses `placementKey`.
- Placement replacement is `PUT /api/admin/documents/:id/placements`.
- Complete-list reorder is `PATCH /api/admin/document-placements/reorder`.
- Full delete is `DELETE /api/admin/documents/:id`; frontend handles 204 without JSON parsing.
- Public lists are published-only and placement-based; secret links are version-pinned and raw tokens are not listed.
- Admin panel is orchestration-only with separate selector, forms, card/actions, version panel, response boundary and mutation module.
- Backend DocumentsService mapping is in `src/system/documents/mappers/document.mapper.ts`; shared document filename/MIME/signature/disposition rules are in `src/system/documents/policies/document-file.policy.ts`.
- Placement validation, exact replacement, initial placement writes and complete-list reorder are in `src/system/documents/services/document-placement.service.ts`.

## Verification and blockers

- Frontend dependencies are restored from the root lockfile with `npm ci`; Next/React/TypeScript/Sass resolve from the frontend root.
- Frontend `tsc --noEmit`, 31 unit tests, lint and production build pass, including the mojibake source scan.
- Desktop/mobile browser smoke passes for public routes, admin login and admin documents: CSS chunks return 200, styles apply, and there are no console/hydration/overflow/mojibake errors.
- Backend build and task-owned runtime start pass. Recovery runtime used seed disabled and isolated document storage/temp; no migrations or mutations were run.
- Routes, slugs, placement keys, API contract, Kubb/generated files and backend were unchanged by the encoding task.
- Main DB/storage unchanged. Persistent `/app/storage`, remote restore/recreate, rate limiting and owner main DB migration review remain production blockers.
- R4A backend checks: mapper/policy unit 18 passed, targeted ESLint passed, backend build passed, isolated document E2E 90/90 passed. DocumentsService is 668 lines after extraction (794 before).
- R4B backend checks: combined mapper/policy/placement unit 23 passed, targeted ESLint passed, backend build passed, isolated document E2E 90/90 passed. DocumentsService is 587 lines after placement extraction; DocumentPlacementService is 122 lines.
- Stale task backend runtimes on ports 4401/4114 were explicitly authorized for shutdown, stopped by exact PID, and their four locked task logs were removed. No task artifacts remain in either repository.

## Current next task

Local recovery and stale task cleanup are complete. Production readiness, R4C and any new refactoring remain separately scoped tasks.

## Codebase Memory

- Frontend project `D-Desktop-dev-web-orders-kciasso-frontend`, `D:/Desktop/dev/web/orders/kciasso-frontend`: fast index refreshed 2026-07-16 after recovery, 2281 nodes / 4857 edges, Git HEAD `a5c15c69f2f3d0f6b73df206434d0d9a8f6087a5`, dirty worktree, `persistence=false`, no repo artifact.
- Backend source was not changed by recovery; its existing index was not refreshed.
