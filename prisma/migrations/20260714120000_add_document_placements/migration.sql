-- Additive placement foundation. Legacy Document.section_key/sort_order remain as
-- compatibility shadow fields until the admin contract migration is fully adopted.
CREATE TABLE "document_placements" (
    "id" SERIAL NOT NULL,
    "document_id" INTEGER NOT NULL,
    "section_key" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "document_placements_pkey" PRIMARY KEY ("id")
);

INSERT INTO "document_placements" ("document_id", "section_key", "sort_order", "updated_at")
SELECT "id", "section_key", "sort_order", CURRENT_TIMESTAMP
FROM "documents";

UPDATE "documents"
SET "status" = 'DRAFT'
WHERE "status" IN ('UNLISTED', 'ARCHIVED');

CREATE UNIQUE INDEX "document_placements_document_id_section_key_key"
ON "document_placements"("document_id", "section_key");

CREATE INDEX "document_placements_section_key_sort_order_document_id_idx"
ON "document_placements"("section_key", "sort_order", "document_id");

ALTER TABLE "document_placements"
ADD CONSTRAINT "document_placements_document_id_fkey"
FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
