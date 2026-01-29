# Multi-stage build for NestJS API
# Using ECR Public Gallery to avoid Docker Hub rate limits
FROM public.ecr.aws/docker/library/node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Build the API
RUN npm run build:api

# Debug: List the build output
RUN echo "=== Build output structure ===" && \
    find dist -type f -name "*.js" | head -20 && \
    echo "=== Main file ===" && \
    ls -la dist/apps/api/apps/api/src/main.js 2>/dev/null || echo "main.js not found at expected path"

# Production stage
FROM public.ecr.aws/docker/library/node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built application
COPY --from=builder /app/dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3333
ENV AWS_REGION=us-east-1

# Expose port
EXPOSE 3333

# Run the application
CMD ["node", "dist/apps/api/apps/api/src/main.js"]
