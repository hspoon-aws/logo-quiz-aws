# Multi-stage build for NestJS API
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Build the API
RUN npm run build:api

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy libs (needed for path aliases)
COPY --from=builder /app/libs ./libs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3333
ENV AWS_REGION=us-east-1

# Expose port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3333/api/levels || exit 1

# Run the application
CMD ["node", "dist/apps/api/main.js"]
