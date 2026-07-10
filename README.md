# kciasso-backend

Backend foundation для сайта ГКУ "КЦИАССО" на NestJS, Prisma и PostgreSQL.

## Быстрый старт

```bash
npm install
cp .env.example .env
npx prisma generate
npm run start:dev
```

## Полезные команды

```bash
npx prisma validate
npx prisma generate
npm run build
npm run prisma:seed
```

## Swagger

- UI: `/api/docs`
- OpenAPI JSON: `/api/docs-json`

## CI/CD

В проект добавлен GitHub Actions workflow:

- `.github/workflows/deploy.yml`

Он работает по схеме, как в `portfolio-backend`:

- на push в `master` собирает Docker image;
- пушит image в GHCR;
- вызывает Dokploy deploy webhook.

Для работы pipeline должны быть настроены:

### GitHub Variables

- `GHCR_NAMESPACE`
- `DOKPLOY_URL`

### GitHub Secrets

- `DOKPLOY_API_KEY`
- `DOKPLOY_APPLICATION_ID`

## Production bootstrap

Контейнер при старте:

- проверяет, существует ли база из `DATABASE_URL`;
- при необходимости создаёт её через подключение к `postgres`;
- выполняет `prisma migrate deploy`;
- при `RUN_SEED_ON_BOOT=true` дополнительно запускает `prisma db seed`.

Если на сервере для пользователя БД нет прав на `CREATE DATABASE`, базу нужно создать заранее либо выдать эти права.
