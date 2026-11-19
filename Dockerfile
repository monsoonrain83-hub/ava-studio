# Full-stack AVA STUDIO: React/Vite frontend and Node-compatible Express API.
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run lint && bun run build

FROM oven/bun:1
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=build /app /app
# Gemini key must be injected as a secret by the deployment platform.
# Local projects and audio use /app/data, which is ephemeral on Cloud Run.
EXPOSE 8080
CMD ["bun", "run", "start"]
