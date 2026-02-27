FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_LIVEKIT_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_LIVEKIT_URL=$NEXT_PUBLIC_LIVEKIT_URL
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=build /app/package.json /app/pnpm-lock.yaml ./
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["pnpm", "start"]
