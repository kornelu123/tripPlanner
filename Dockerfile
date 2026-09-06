FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY --from=build /app /app
USER node
EXPOSE 3000
CMD ["pnpm", "--filter", "@trip-planner/web", "start"]
