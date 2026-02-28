FROM node:22-bookworm

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g pnpm@10

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

ARG UID=10001
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/app" \
    --shell "/sbin/nologin" \
    --uid "${UID}" \
    appuser

RUN chown -R appuser:appuser /app
USER appuser

RUN pnpm download-files

USER root
RUN pnpm prune --prod && chown -R appuser:appuser /app
USER appuser

ENV NODE_ENV=production

CMD ["node", "dist/main.js", "start"]
