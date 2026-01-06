FROM oven/bun:1.3
WORKDIR /app

# Copy workspace root config
COPY backend/package.json backend/bun.lock ./

# Copy shared packages
COPY backend/packages ./packages

# Copy service code
COPY backend/services/board-query ./services/board-query

# Install dependencies
RUN bun install

# Run service
WORKDIR /app/services/board-query
CMD ["bun", "run", "src/index.ts"]
