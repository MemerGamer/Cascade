FROM oven/bun:1.3
WORKDIR /app

# Copy workspace root config
COPY backend/package.json backend/bun.lock ./

# Copy shared packages
COPY backend/packages ./packages

# Copy service code
COPY backend/services/activity ./services/activity

# Install dependencies
RUN bun install

# Run service
WORKDIR /app/services/activity
CMD ["bun", "run", "src/index.ts"]
