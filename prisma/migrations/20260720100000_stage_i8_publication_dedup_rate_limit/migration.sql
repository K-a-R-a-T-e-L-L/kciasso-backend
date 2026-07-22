CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED');

CREATE TABLE "stored_files" (
    "id" SERIAL NOT NULL,
    "sha256" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);
DROP INDEX IF EXISTS "document_versions_storage_key_key";
CREATE UNIQUE INDEX "stored_files_sha256_key" ON "stored_files"("sha256");
CREATE UNIQUE INDEX "stored_files_storage_key_key" ON "stored_files"("storage_key");

ALTER TABLE "news"
    ADD COLUMN "publication_status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN "publish_from" TIMESTAMP(3),
    ADD COLUMN "publish_until" TIMESTAMP(3),
    ADD COLUMN "display_published_at" TIMESTAMP(3),
    ADD COLUMN "publication_revision" INTEGER NOT NULL DEFAULT 0;

UPDATE "news"
SET "publication_status" = CASE
    WHEN "is_published" = true AND "published_at" > CURRENT_TIMESTAMP THEN 'SCHEDULED'::"PublicationStatus"
    WHEN "is_published" = true THEN 'PUBLISHED'::"PublicationStatus"
    ELSE 'DRAFT'::"PublicationStatus"
END,
"publish_from" = "published_at",
"display_published_at" = "published_at";

ALTER TABLE "document_placements"
    ADD COLUMN "publication_status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN "publish_from" TIMESTAMP(3),
    ADD COLUMN "publish_until" TIMESTAMP(3),
    ADD COLUMN "display_published_at" TIMESTAMP(3),
    ADD COLUMN "publication_revision" INTEGER NOT NULL DEFAULT 0;

UPDATE "document_placements" p
SET "publication_status" = CASE WHEN d."status" = 'PUBLISHED' THEN 'PUBLISHED'::"PublicationStatus" ELSE 'DRAFT'::"PublicationStatus" END,
    "publish_from" = CASE WHEN d."status" = 'PUBLISHED' THEN CURRENT_TIMESTAMP ELSE NULL END,
    "display_published_at" = CASE WHEN d."status" = 'PUBLISHED' THEN CURRENT_TIMESTAMP ELSE NULL END
FROM "documents" d WHERE d."id" = p."document_id";

ALTER TABLE "document_versions" ADD COLUMN "stored_file_id" INTEGER;
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_stored_file_id_fkey"
    FOREIGN KEY ("stored_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "admin_auth_rate_limit_buckets" (
    "key_hash" TEXT NOT NULL,
    "bucket_type" TEXT NOT NULL,
    "window_started_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "blocked_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "admin_auth_rate_limit_buckets_pkey" PRIMARY KEY ("key_hash")
);

CREATE INDEX "news_publication_idx" ON "news"("publication_status", "publish_from", "publish_until", "display_published_at");
CREATE INDEX "document_placements_publication_idx" ON "document_placements"("section_key", "publication_status", "publish_from", "publish_until", "sort_order");
CREATE INDEX "admin_auth_rate_limit_buckets_updated_at_idx" ON "admin_auth_rate_limit_buckets"("updated_at");
CREATE INDEX "admin_auth_rate_limit_buckets_blocked_until_idx" ON "admin_auth_rate_limit_buckets"("blocked_until");
