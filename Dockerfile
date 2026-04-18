FROM node:24-alpine AS core
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
RUN corepack enable && yarn install --immutable
COPY tsup.config.ts tsconfig.json ./
COPY src ./src
RUN yarn build

FROM node:24-alpine AS playground
WORKDIR /app
COPY --from=core /app/dist ./dist
WORKDIR /app/playground
COPY playground/package.json playground/yarn.lock playground/.yarnrc.yml ./
RUN corepack enable && yarn install --immutable
COPY playground/ ./
RUN yarn build

FROM caddy:2-alpine
COPY --from=playground /app/playground/dist /usr/share/caddy
COPY playground/Caddyfile /etc/caddy/Caddyfile
