# ============================================
# SvelteKit Frontend Dockerfile
# Multi-stage build for optimized image size
# ============================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Enable pnpm
RUN npm install -g pnpm

# Copy lock and package files
COPY pnpm-lock.yaml package.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src ./src
COPY static ./static
COPY svelte.config.js vite.config.ts tsconfig.json ./

# Build application
RUN pnpm run build

# ============================================
# Runtime stage
# ============================================

FROM node:20-alpine

WORKDIR /app

# Enable pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder
COPY --from=builder /app/build ./build

# Expose port
EXPOSE 3000

# Environment
ENV NODE_ENV=production

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["node", "build"]
