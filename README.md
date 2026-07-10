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
