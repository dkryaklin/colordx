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

# Caddy runs as an unprivileged user and listens on 8080.
FROM caddy:2-alpine
# Caddy keeps state in $XDG_DATA_HOME (/data) and $XDG_CONFIG_HOME (/config);
# hand both to the runtime user so it can write there.
RUN addgroup -S -g 1001 caddy && adduser -S -u 1001 -G caddy caddy \
  && chown -R caddy:caddy /data /config
COPY --from=playground /app/playground/dist /usr/share/caddy
COPY playground/Caddyfile /etc/caddy/Caddyfile
USER caddy

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
