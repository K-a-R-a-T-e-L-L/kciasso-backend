CREATE TYPE "GlobalHtmlSlot" AS ENUM (
  'AFTER_HEADER',
  'BEFORE_CONTENT',
  'AFTER_CONTENT',
  'BEFORE_CONTACTS',
  'AFTER_CONTACTS',
  'BEFORE_FOOTER'
);

CREATE TABLE "global_html_sections" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "html" TEXT NOT NULL,
  "css" TEXT,
  "javascript" TEXT,
  "iframe_height_px" INTEGER NOT NULL DEFAULT 320,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "slot" "GlobalHtmlSlot" NOT NULL DEFAULT 'AFTER_CONTENT',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" INTEGER,
  "updated_by_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "global_html_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "global_html_sections_key_key" ON "global_html_sections"("key");
CREATE INDEX "global_html_sections_is_enabled_slot_sort_order_idx" ON "global_html_sections"("is_enabled", "slot", "sort_order");
CREATE INDEX "global_html_sections_slot_sort_order_idx" ON "global_html_sections"("slot", "sort_order");

UPDATE "page_sections"
SET "sort_order" = "sort_order" + 1
WHERE "page_layout_id" IN (SELECT "id" FROM "page_layouts" WHERE "page_key" = 'home');

INSERT INTO "page_sections" (
  "page_layout_id",
  "type",
  "system_key",
  "internal_name",
  "sort_order",
  "is_enabled",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  'SYSTEM'::"PageSectionType",
  'home.slider',
  'Карусель главной страницы',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "page_layouts"
WHERE "page_key" = 'home'
  AND NOT EXISTS (
    SELECT 1 FROM "page_sections"
    WHERE "page_layout_id" = "page_layouts"."id"
      AND "system_key" = 'home.slider'
      AND "deleted_at" IS NULL
  );
