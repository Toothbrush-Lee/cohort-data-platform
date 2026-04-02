# Frontend Dockerfile - Development
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Development stage
FROM base AS development
ENV NODE_ENV=development
CMD ["pnpm", "dev"]

# Production build stage
FROM base AS builder
RUN pnpm build

# Production runner stage
FROM node:20-alpine AS runner
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml* ./
RUN pnpm install --prod

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
