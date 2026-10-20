# TruckFlow production image (SQLite on a mounted volume at /data).
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* values are inlined at build time.
ARG NEXT_PUBLIC_DEMO_MODE=0
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE
RUN npx prisma generate && npx next build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATABASE_URL=file:/data/truckflow.db
COPY --from=build /app /app
RUN mkdir -p /data
EXPOSE 3000
CMD ["sh", "deploy/entrypoint.sh"]
