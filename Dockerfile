# Full 2Night runtime: Next.js 16, both HTML5 games and Python/OpenCV.
# Supports amd64 and OCI Ampere A1 arm64 via the official Bun image.
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1 AS runtime
USER root
RUN apt-get update \
  && apt-get install --no-install-recommends -y python3 python3-opencv python3-numpy ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PYTHON_BIN=/usr/bin/python3
COPY --from=build --chown=bun:bun /app/.next/standalone ./
COPY --from=build --chown=bun:bun /app/.next/static ./.next/static
COPY --from=build --chown=bun:bun /app/public ./public
COPY --from=build --chown=bun:bun /app/scripts ./scripts
USER bun
EXPOSE 3000
CMD ["bun", "server.js"]
