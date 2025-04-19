# -----------------------------
# 👷 Builder Stage
# -----------------------------
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and tsconfig
COPY tsconfig*.json ./
COPY src ./src

# Build the application
RUN npm run build

# Clean up dev dependencies
RUN npm prune --omit=dev

# Clean unnecessary files
RUN find node_modules -type f -name "*.d.ts" -delete && \
    find node_modules -type f -name "*.map" -delete && \
    find node_modules -type f -name "*.ts" -delete

# -----------------------------
# 🏗 Production Stage
# -----------------------------
FROM gcr.io/distroless/nodejs20-debian11

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production

EXPOSE 3000

CMD ["dist/main"]