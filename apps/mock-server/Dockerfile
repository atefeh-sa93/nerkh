# Build from the repository root:
#   docker build -f apps/mock-server/Dockerfile -t nerkh-mock-server .
FROM node:22-alpine

WORKDIR /repo
RUN corepack enable

# Download dependencies from the lockfile alone, so this layer is cached
# until pnpm-lock.yaml changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch --prod

# Install only the server and the workspace packages it depends on.
COPY . .
RUN pnpm install --offline --prod --frozen-lockfile --filter "@nerkh/mock-server..."

ENV NODE_ENV=production \
    PORT=4000 \
    SEED=42 \
    RATE=200
EXPOSE 4000

USER node
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

# Node 22.18+ runs the TypeScript source directly.
CMD ["node", "apps/mock-server/src/main.ts"]
