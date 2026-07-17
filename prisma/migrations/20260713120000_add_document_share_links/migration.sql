CREATE TABLE "document_share_links" (
    "id" SERIAL NOT NULL,
    "document_version_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_access_at" TIMESTAMP(3),
    "access_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "document_share_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_share_links_token_hash_key" ON "document_share_links"("token_hash");
CREATE INDEX "document_share_links_document_version_id_idx" ON "document_share_links"("document_version_id");
CREATE INDEX "document_share_links_revoked_at_expires_at_idx" ON "document_share_links"("revoked_at", "expires_at");
CREATE INDEX "document_share_links_created_at_idx" ON "document_share_links"("created_at");

ALTER TABLE "document_share_links" ADD CONSTRAINT "document_share_links_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_share_links" ADD CONSTRAINT "document_share_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
