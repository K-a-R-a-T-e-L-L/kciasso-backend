CREATE TYPE "DocumentsAccessMode" AS ENUM ('NONE', 'ALL', 'SELECTED_GROUPS');
CREATE TYPE "DocumentGroup" AS ENUM ('GIA_9', 'GIA_11', 'GIA', 'QUALITY', 'REGIONAL', 'ABOUT');

ALTER TABLE "users"
    ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "can_manage_site_settings" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "can_manage_news" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "documents_access_mode" "DocumentsAccessMode" NOT NULL DEFAULT 'NONE',
    ADD COLUMN "document_groups" "DocumentGroup"[] NOT NULL DEFAULT ARRAY[]::"DocumentGroup"[];
