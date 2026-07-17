# Persistent document storage and backup foundation

## Production configuration

The production image is built by `.github/workflows/deploy.yml` from the root
`Dockerfile` and deployed as a Dokploy application. The application container
must have one persistent volume mounted at `/app/storage`. Set:

```dotenv
NODE_ENV=production
DOCUMENT_STORAGE_ROOT=/app/storage/documents
DOCUMENT_TEMP_ROOT=/app/storage/tmp
```

The image creates both directories and the startup preflight verifies
read/write access. It does not chmod the mount or use `777` permissions.

The checked-in local compose file uses the named volume `documents_storage` at
the same mount point. This does not prove the remote Dokploy volume exists.

## Dokploy rollout

1. Create or select a persistent volume for the application.
2. Mount it to `/app/storage` in the application/container settings.
3. Set the production variables above and keep the validated
   `DOCUMENT_MAX_FILE_SIZE_MB` limit.
4. Deploy the image produced by the workflow.
5. Confirm logs contain `Document storage directories are ready`.
6. Upload one non-user test document, recreate only the application container,
   verify bytes and SHA-256, then remove only that test record and file.

Remote Dokploy settings are not inspectable from this workspace. The remote
persistent mount remains a production blocker until steps 1–4 are confirmed.
The application remains single-replica; multi-replica storage coordination is
out of scope.

## Read-only reconciliation

Run with production-safe environment variables:

```bash
npm run documents:reconcile
```

The command opens a Nest application context, reads metadata and storage,
prints dry-run counts, and exits. It never deletes rows or files and does not
print storage paths, storage keys, or original file names. `oldTempFiles` is a
count; temporary files are not required document backup data.

## Backup procedure

Back up PostgreSQL metadata and the document volume in one coordinated backup
window. Store artifacts outside the application volume with restricted access
and a manifest containing creation time, database/volume identity, file count,
byte count, and SHA-256 checksums.

Example trusted-host procedure (provide secrets out of band):

```bash
pg_dump --format=custom --file=kciasso-YYYYMMDD.dump "$DATABASE_URL"
tar --sort=name --mtime='UTC 1970-01-01' --numeric-owner --file=kciasso-YYYYMMDD-storage.tar -C /app/storage documents
sha256sum kciasso-YYYYMMDD.dump kciasso-YYYYMMDD-storage.tar > kciasso-YYYYMMDD.sha256
```

This is a runbook, not an in-app backup job. Check that `pg_dump`, `tar`, and
the secure backup destination are available in the deployment environment.
Do not back up `/app/storage/tmp` as application data.

## Restore procedure

Restore into a new isolated database and a new isolated volume first:

```bash
createdb "$RESTORE_DATABASE_NAME"
pg_restore --clean --if-exists --dbname="$RESTORE_DATABASE_URL" kciasso-YYYYMMDD.dump
tar --extract --file=kciasso-YYYYMMDD-storage.tar -C /isolated-restore/storage
sha256sum --check kciasso-YYYYMMDD.sha256
```

Point an isolated backend instance at the restored database and mount, run
`npm run documents:reconcile`, then verify counts, current versions, bytes,
and SHA-256. Never restore over the development database, user-owned storage,
or the live production volume during this foundation stage.
