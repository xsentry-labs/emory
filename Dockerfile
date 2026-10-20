# Single container: Next.js (UI + API) + in-process worker + SQLite on a volume.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# For restores: node scripts/restore-backup.mjs (see README, "Backups").
COPY --from=build /app/scripts/restore-backup.mjs ./scripts/restore-backup.mjs
COPY --from=build /app/lib/backup-core.mjs ./lib/backup-core.mjs
# Railway mounts the volume at /data at runtime (root-owned), so run as root.
EXPOSE 3000
CMD ["node", "server.js"]
