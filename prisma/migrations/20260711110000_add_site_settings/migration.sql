-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL,
    "site_key" TEXT NOT NULL,
    "gia_hotline_phone" TEXT NOT NULL,
    "information_phone" TEXT NOT NULL,
    "ege_trust_phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_settings_site_key_key" ON "site_settings"("site_key");

-- Seed singleton
INSERT INTO "site_settings" (
    "id",
    "site_key",
    "gia_hotline_phone",
    "information_phone",
    "ege_trust_phone",
    "email",
    "created_at",
    "updated_at"
)
SELECT
    'site-settings-default',
    'default',
    '8 (3842) 587025',
    '8 (495) 198-92-38',
    '8 (495) 198-93-38',
    'info@kcias.ru',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1
    FROM "site_settings"
    WHERE "site_key" = 'default'
);
