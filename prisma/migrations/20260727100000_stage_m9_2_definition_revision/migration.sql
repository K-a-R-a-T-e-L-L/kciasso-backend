-- Definition-level optimistic concurrency for global custom content.
ALTER TABLE "section_definitions" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
