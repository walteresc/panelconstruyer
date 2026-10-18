FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml pnpm-lock.expected.sha256 ./
COPY scripts/verify-lockfile.mjs ./scripts/verify-lockfile.mjs
COPY apps ./apps
COPY packages ./packages
COPY patches ./patches

RUN pnpm install:verified

ENV NODE_ENV=production
USER node

# tsx (y no --experimental-strip-types): el código compartido importa módulos .ts con especificadores ".js".
CMD ["sh", "-c", "cd apps/worker && exec ./node_modules/.bin/tsx src/index.ts"]
