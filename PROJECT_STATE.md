# KCIASSO — PROJECT_STATE

Последнее ручное обновление: 2026-07-12

## 1. Логический проект

KCIASSO состоит из двух связанных репозиториев:

- Frontend: `D:\Desktop\dev\web\orders\kciasso-frontend`
- Backend: `D:\Desktop\dev\web\orders\kciasso-backend`

Оба репозитория рассматриваются как один логический проект.

## 2. Канонические служебные файлы

- PROJECT_STATE: `D:\Desktop\dev\web\orders\kciasso-backend\PROJECT_STATE.md`
- Подробный отчёт последней задачи: `D:\Desktop\dev\web\orders\kciasso-backend\отчёт.txt`

Во frontend нельзя создавать отдельные `PROJECT_STATE.md` и `отчёт.txt`.

## 3. Постоянные правила работы

- Перед началом задачи читать этот файл.
- `отчёт.txt` полностью перезаписывать после каждой выполненной задачи или запрошенного анализа.
- В `отчёт.txt` описывать только последнюю задачу или последний аудит по обоим связанным репозиториям.
- Не печатать длинный отчёт в чат.
- Не откатывать незакоммиченные изменения пользователя.
- Не использовать глобальное завершение `node.exe`.
- Останавливать только frontend/backend/Playwright и другие длительные процессы, запущенные в рамках текущей задачи.
- Перед завершением проверять освобождение временных портов.
- Не изменять вручную generated Kubb-файлы.
- Запускать Kubb-генерацию только после изменения OpenAPI-контракта.
- Сохранять русскоязычные файлы в UTF-8 и проверять отсутствие mojibake.

## 4. Frontend

### Стек

- Next.js 16
- React 19
- TypeScript
- App Router
- SCSS Modules
- частичное использование Tailwind
- Kubb generated OpenAPI client
- SSR-first подход для публичных страниц

### Основные пути

- Public routes: `src/app/(site)`
- Admin routes: `src/app/admin`
- API adapters: `src/shared/api/adapters`
- Generated API: `src/shared/api/generated`
- Public layouts: `src/widgets/layout`
- Reusable sections: `src/widgets/sections`
- Public content/mock layer: `src/shared/content`

### Generated Kubb

Нельзя редактировать вручную:

`D:\Desktop\dev\web\orders\kciasso-frontend\src\shared\api\generated\**`

Порядок изменения API:

1. Изменить backend DTO/controller.
2. Проверить Swagger/OpenAPI.
3. Запустить штатную генерацию Kubb.
4. Проверить generated diff.
5. Выполнить frontend lint/build.

## 5. Backend

### Стек

- NestJS 10
- Prisma 5
- PostgreSQL
- Swagger/OpenAPI
- JWT
- server-side sessions
- section-based permissions

### Основные пути

- Prisma schema: `prisma/schema.prisma`
- Prisma migrations: `prisma/migrations`
- User/auth module: `src/system/user`
- News module: `src/system/news`
- Site settings module: `src/system/site-settings`

### Обычные локальные адреса

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- Swagger UI: `http://localhost:4000/api/docs`
- OpenAPI JSON: `http://localhost:4000/api/docs-json`

Не считать эти порты свободными без проверки. При конфликте использовать временные порты и остановить только процессы, запущенные текущей задачей.

## 6. Архитектура

- Public и admin layouts разделены.
- Admin routes не используют публичные Header и Footer.
- Public news загружаются через backend API.
- Admin auth, news, news categories, users и permissions работают через backend.
- Значительная часть остальных public-разделов пока использует static/mock content layer.
- Frontend обращается к generated API через adapters.
- UI-компоненты не должны напрямую зависеть от transport-слоя без необходимости.

## 7. Реализованные функции

По последнему подтверждённому аудиту и выполненным задачам реализованы:

- public news list;
- public news detail;
- public news categories;
- admin news CRUD;
- scheduled news publishing;
- admin news category CRUD;
- создание и редактирование подадминов;
- section permissions;
- отдельный admin layout;
- homepage news panel;
- cover image новостей;
- compact GIA cards на главной;
- detailed GIA cards на `/gia`;
- Header hotline;
- UniversalContactsSection;
- official resources section;
- SiteSettings для централизованных контактов;
- admin route `/admin/settings`;
- public и admin SiteSettings API.
- порядок четырёх управляемых секций главной страницы через `homeSectionsOrder`;
- нормализация повреждённых массивов порядка и строгая DTO-валидация.

## 8. SiteSettings

Централизованно управляемые контакты:

- горячая линия ГИА;
- телефон для справок;
- телефон доверия ЕГЭ;
- электронная почта.

Ожидаемые потребители:

- Header desktop;
- Header mobile menu;
- UniversalContactsSection;
- ContactsPage;
- Footer.

Источник истины должен находиться в backend SiteSettings.

Frontend fallback допускается только как единый аварийный источник, а не как параллельная основная конфигурация.

Значения по умолчанию:

- Горячая линия ГИА: `8 (3842) 587025`
- Телефон для справок: `8 (495) 198-92-38`
- Телефон доверия ЕГЭ: `8 (495) 198-93-38`
- Email: `info@kcias.ru`

## 9. Важные ограничения

Нельзя ломать:

- cookie `kciasso_admin_token`;
- стабильные `sectionId` permissions;
- public news API;
- различие compact GIA на главной и detailed GIA на `/gia`;
- исключение UniversalContactsSection на `/o-centre/kontakty`;
- generated Kubb flow;
- существующие незакоммиченные изменения пользователя.
- Hero, UniversalContactsSection, Header и Footer не участвуют в сортировке.

## 10. Команды проверки

### Frontend

```bash
npm run lint
npm run build
```

### Backend

```bash
npm run build
npx prisma validate
npx prisma migrate status
```

### Kubb

```bash
npm run api:generate
```

Kubb запускать только после фактического изменения OpenAPI-контракта.

Не запускать destructive database-команды без прямого разрешения пользователя.

## 11. Известные проблемы, требующие повторной проверки

После реализации SiteSettings наблюдались:

- `AdminApiError: fetch failed` при открытии защищённой админки;
- повреждённая кириллица в Header и Footer;
- возможная необходимость перезапуска уже работающего backend после изменения Prisma Client;
- риск оставленных временных frontend/backend-процессов после тестов.

Не считать эти проблемы исправленными без нового отчёта и runtime-проверки.

Если исправление уже выполнено, Codex должен проверить код/runtime и обновить этот раздел подтверждёнными фактами.

Проверено 2026-07-12: сохранение объединённых SiteSettings (контакты + `homeSectionsOrder`) работает через единый Server Action; после reload порядок сохраняется, public HomePage применяет его, контакты не теряются. Невалидный backend PATCH возвращает 400 и массив validation-объектов; frontend formatter больше не показывает `[object Object]`. Телефоны валидируются как российские номера после нормализации пробелов/скобок/дефисов, отображаемый формат сохраняется; текущие три номера подтверждены runtime. На public HomePage исправлены missing React key для управляемых секций и legacy `next/image` `objectFit`; для шести официальных логотипов добавлен responsive `sizes`. Dev и production runtime не показывают целевые предупреждения.

## 12. Codebase Memory

- Backend: project `D-Desktop-dev-web-orders-kciasso-backend`, 643 nodes / 1457 edges, `persistence=false`, indexed 2026-07-12; HEAD `6b69391fc4a30dbda8f3cf191078137e2b2bc6af`, uncommitted changes present.
- Frontend: project `D-Desktop-dev-web-orders-kciasso-frontend`, 1756 nodes / 3772 edges, `persistence=false`, indexed 2026-07-12; HEAD `1aebfb018e6a218d96eb4739c0dc383fb5044d`, uncommitted changes present.
- No `.codebase-memory` or graph artifact was created in either repository.

## 13. Следующие этапы

Приоритетный порядок:

1. Проверить и стабилизировать SiteSettings после последней реализации.
2. Проверить admin/backend connection.
3. Проверить отсутствие mojibake.
4. Убедиться, что временные процессы и порты корректно очищаются.
5. Реализовать управление порядком секций главной страницы.

## 13. Управление порядком секций главной

Предполагаемая управляемая часть:

- быстрый доступ;
- важные ресурсы;
- ГИА;
- официальные ресурсы.

Ограничения:

- Hero всегда остаётся первым.
- UniversalContactsSection остаётся последней перед Footer.
- Header и Footer не участвуют в сортировке.
- Порядок хранится по стабильным ключам.
- Произвольный HTML не используется.
- Не превращать эту функцию в полноценный page builder.

## 14. Правила обновления PROJECT_STATE

Обновлять этот файл только при изменении фактического состояния проекта.

Не записывать сюда:

- полный diff;
- длинные логи;
- подробную историю задач;
- полный список команд последней задачи;
- неподтверждённые выводы.

Подробности последней задачи всегда находятся в `отчёт.txt`.
