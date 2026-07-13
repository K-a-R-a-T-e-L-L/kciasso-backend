ALTER TABLE "site_settings"
ADD COLUMN "home_sections_order" TEXT[] NOT NULL DEFAULT ARRAY[
    'home.quick-access',
    'home.resources',
    'home.gia-reference',
    'home.official-resources'
]::TEXT[];
