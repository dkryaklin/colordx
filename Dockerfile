# Keep in sync with the "packageManager" field in package.json / playground/package.json.
ARG PNPM_VERSION=12.3.4

FROM node:24-alpine AS core
ARG PNPM_VERSION
WORKDIR /app
RUN npm install -g pnpm@${PNPM_VERSION}
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsup.config.ts tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM node:24-alpine AS playground
ARG PNPM_VERSION
WORKDIR /app
RUN npm install -g pnpm@${PNPM_VERSION}
COPY --from=core /app/dist ./dist
WORKDIR /app/playground
COPY playground/package.json playground/pnpm-lock.yaml playground/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY playground/ ./
RUN pnpm build

FROM caddy:2-alpine
COPY --from=playground /app/playground/dist /usr/share/caddy
COPY playground/Caddyfile /etc/caddy/Caddyfile
