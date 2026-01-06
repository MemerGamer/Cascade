FROM oven/bun:1.3 as build

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the app
RUN bun run build

# Production stage
FROM oven/bun:1.3

WORKDIR /app

# Copy built files
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./package.json

# Expose port
EXPOSE 3000

# Start the server
CMD ["bun", "run", ".output/server/index.mjs"]
