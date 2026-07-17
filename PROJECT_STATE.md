# KCIASSO — PROJECT_STATE

Last updated: 2026-07-16, CI/deploy recovery verified.

## Logical project

- Frontend: `D:\Desktop\dev\web\orders\kciasso-frontend`
- Backend: `D:\Desktop\dev\web\orders\kciasso-backend`
- Canonical report: `D:\Desktop\dev\web\orders\kciasso-backend\отчёт.txt`

## Stack and architecture

- Frontend: Next.js 16, React 19, TypeScript, App Router, SCSS Modules, Kubb.
- Backend: NestJS 10, Prisma 5, PostgreSQL, Swagger/OpenAPI, JWT and section permissions.
- Documents use one Document/versions/files model with fixed registry placements and quarantine-backed storage.
- GitHub Actions builds both deploy images from repository root with root `Dockerfile` and context `.`.
- Production backend startup prepares storage, bootstraps the database, deploys migrations, optionally runs the self-contained `prisma/**` seed, then starts `dist/src/main.js`.

## Deploy configuration

- Effective deploy branch for both repositories is `master`.
- Frontend local `master` tracks `origin/master`; frontend remote currently has only `master`.
- Backend local `master` tracks `origin/master`; legacy remote `main` remains at `1a979cc` and GitHub remote HEAD still points to `main`.
- Frontend CI pins Node 22/npm 10.9.8 and runs clean install, lint, build, image push and Dokploy trigger.
- Backend CI builds the root production image, pushes it and triggers Dokploy.

## Main modules, routes and data

- Backend modules cover users/auth/section permissions, news/categories, site settings and document storage/sharing; PostgreSQL is accessed through Prisma.
- Public API is under `/api/public/**`; administrative API is under `/api/admin/**`; user/auth routes are under `/api/user/**`.
- Documents use versioned files, fixed registry placements and secret version-pinned share links. Main files live under persistent `storage/documents`; temporary uploads use `storage/tmp`.
- Frontend public routes include home, news, GIA, education quality, resources and centre pages; administration is under `/admin/**`.
- Admin document placement replacement is `PUT /api/admin/documents/:id/placements`; complete-list reorder is `PATCH /api/admin/document-placements/reorder`.

## Commands and generated paths

- Frontend checks: `npm ci`, `npm run lint`, `npm run build`; production image: `docker build .` from frontend root.
- Backend checks: `npm ci`, `npx prisma generate`, `npm run build`, `npm test -- --runInBand`; production image: `docker build .` from backend root.
- Backend production start: `npm run start:container`; seed is controlled by `RUN_SEED_ON_BOOT=true`.
- Generated paths: frontend Kubb client under `src/shared/api/generated`; backend Prisma DTOs under `src/.generated/prisma`. Do not edit either manually.

## Verification

- Frontend remote commit `3a5d78bcf3a22a66b87ad58b407296c721e6f399`: clean Linux/Node 22/npm 10.9.8 image build passed, including `npm ci`, lint and Next production build.
- Backend remote commit `588f2b74770291af5fd9ab5cb17416cb9dcf138e`: root production image build passed, including `npm ci`, Prisma generate and Nest build.
- Backend isolated production startup passed against task-only PostgreSQL/storage: database bootstrap, 8 migrations, seed, Nest startup, internal HTTP and repeated seed all passed.
- GitHub Actions frontend run 14 and backend run 8 completed successfully, including image push and Dokploy trigger.
- Backend unit tests: 23/23 passed. Frontend has no `test` script.
- No Prisma schema/migration, OpenAPI, Kubb or generated file was changed by CI recovery.

## Constraints and known risks

- Do not manually edit generated Kubb/Prisma files.
- Do not run destructive checks against production DB or storage.
- Main storage/uploads and user processes must remain untouched.
- Align the backend GitHub default branch/remote HEAD with `master` when repository settings access is available; do not delete legacy `main` without an explicit migration decision.
- Dokploy application-side branch/settings were not independently readable, but both successful workflows directly invoked `application.deploy` after publishing SHA-tagged images.

## Current next task

Observe the deployed frontend/backend versions in Dokploy. If the applications are stale despite successful triggers, redeploy both using frontend `3a5d78b` and backend `588f2b7`; separately align the backend GitHub default branch to `master`.

## Codebase Memory

- Frontend index refreshed 2026-07-16: 2281 nodes / 4857 edges, `persistence=false`, no repository artifact.
- Backend index refreshed 2026-07-16: 984 nodes / 2413 edges, `persistence=false`, no repository artifact.
