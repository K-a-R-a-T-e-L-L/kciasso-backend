INSERT INTO "sections" ("section_id", "title", "kind", "route", "parent_id", "created_at", "updated_at")
VALUES (
    'documents',
    'Документы',
    'page',
    '/admin/documents',
    (SELECT "id" FROM "sections" WHERE "section_id" = 'gia-9'),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("section_id") DO UPDATE SET
    "title" = EXCLUDED."title",
    "kind" = EXCLUDED."kind",
    "route" = EXCLUDED."route",
    "parent_id" = EXCLUDED."parent_id",
    "deleted_at" = NULL;
