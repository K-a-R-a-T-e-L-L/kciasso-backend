-- Additive M9.2 storage. Legacy page_sections/global_html_sections are retained.
CREATE TYPE "SectionDefinitionType" AS ENUM ('PAGE_SYSTEM', 'GLOBAL_SYSTEM', 'PAGE_CUSTOM_HTML', 'GLOBAL_CUSTOM_HTML');

CREATE TABLE "section_definitions" (
    "id" SERIAL NOT NULL,
    "key" TEXT,
    "type" "SectionDefinitionType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system_renderer_key" TEXT,
    "html" TEXT,
    "css" TEXT,
    "javascript" TEXT,
    "iframe_height_px" INTEGER,
    "owner_page_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "section_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "section_definitions_key_key" ON "section_definitions"("key");
CREATE INDEX "section_definitions_type_owner_page_key_idx" ON "section_definitions"("type", "owner_page_key");
CREATE INDEX "section_definitions_system_renderer_key_idx" ON "section_definitions"("system_renderer_key");

CREATE TABLE "page_section_placements" (
    "id" SERIAL NOT NULL,
    "page_layout_id" INTEGER NOT NULL,
    "page_key" TEXT NOT NULL,
    "section_definition_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "page_section_placements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "page_section_placements_page_key_section_definition_id_key" ON "page_section_placements"("page_key", "section_definition_id");
CREATE INDEX "page_section_placements_page_key_sort_order_idx" ON "page_section_placements"("page_key", "sort_order");
CREATE INDEX "page_section_placements_section_definition_id_idx" ON "page_section_placements"("section_definition_id");
ALTER TABLE "page_section_placements" ADD CONSTRAINT "page_section_placements_page_layout_id_fkey" FOREIGN KEY ("page_layout_id") REFERENCES "page_layouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "page_section_placements" ADD CONSTRAINT "page_section_placements_section_definition_id_fkey" FOREIGN KEY ("section_definition_id") REFERENCES "section_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
