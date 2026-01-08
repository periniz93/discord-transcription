FROM node:22.12.0-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/bot/package.json apps/bot/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

COPY . .

RUN npm run build

FROM node:22.12.0-slim

WORKDIR /app

COPY --from=builder /app /app

ENV NODE_ENV=production

CMD ["npm", "run", "bot"]
