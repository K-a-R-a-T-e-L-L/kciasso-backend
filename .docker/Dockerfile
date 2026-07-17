FROM node:22-slim AS builder

WORKDIR /app

RUN apt-get update -y \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --no-audit --progress=false

COPY . .

RUN npx prisma generate
RUN npm run build

FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads /app/storage

EXPOSE 4000

CMD ["npm", "run", "start:container"]