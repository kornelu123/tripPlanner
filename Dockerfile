FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=$NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
RUN pnpm install --frozen-lockfile && pnpm build

FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /app
COPY --from=build /app /app
USER node
EXPOSE 3000
CMD ["pnpm", "--filter", "@trip-planner/web", "start"]
