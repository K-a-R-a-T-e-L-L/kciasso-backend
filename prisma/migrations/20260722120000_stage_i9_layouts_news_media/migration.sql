CREATE TYPE "PageSectionType" AS ENUM ('SYSTEM', 'CUSTOM_HTML');
CREATE TYPE "NewsMediaStatus" AS ENUM ('PENDING', 'READY', 'QUARANTINED');

CREATE TABLE "page_layouts" (
  "id" SERIAL NOT NULL,
  "page_key" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "page_layouts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "page_layouts_page_key_key" ON "page_layouts"("page_key");

CREATE TABLE "page_sections" (
  "id" SERIAL NOT NULL,
  "page_layout_id" INTEGER NOT NULL,
  "type" "PageSectionType" NOT NULL,
  "system_key" TEXT,
  "internal_name" TEXT NOT NULL,
  "raw_html" TEXT,
  "sort_order" INTEGER NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "iframe_height_px" INTEGER,
  "created_by_id" INTEGER,
  "updated_by_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "page_sections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "page_sections_layout_enabled_order_idx" ON "page_sections"("page_layout_id", "is_enabled", "sort_order");
CREATE INDEX "page_sections_layout_order_idx" ON "page_sections"("page_layout_id", "sort_order");
CREATE UNIQUE INDEX "page_sections_active_system_key_key" ON "page_sections"("page_layout_id", "system_key") WHERE "system_key" IS NOT NULL AND "deleted_at" IS NULL;
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_page_layout_id_fkey" FOREIGN KEY ("page_layout_id") REFERENCES "page_layouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "news_media" (
  "id" SERIAL NOT NULL,
  "sha256" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "extension" TEXT NOT NULL,
  "size_bytes" BIGINT NOT NULL,
  "source_url" TEXT,
  "imported_at" TIMESTAMP(3),
  "status" "NewsMediaStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "quarantined_at" TIMESTAMP(3),
  CONSTRAINT "news_media_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "news_media_sha256_key" ON "news_media"("sha256");
CREATE UNIQUE INDEX "news_media_storage_key_key" ON "news_media"("storage_key");
ALTER TABLE "news" ADD COLUMN "cover_media_id" INTEGER;
CREATE INDEX "news_cover_media_id_idx" ON "news"("cover_media_id");
ALTER TABLE "news" ADD CONSTRAINT "news_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "news_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
