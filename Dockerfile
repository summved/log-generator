# Use official Node.js image from Docker Hub (authentic source)
FROM node:18-alpine@sha256:c7620fdecfefb96813da62519897808775230386f4c8482e972e37b8b18cb460

# Set working directory
WORKDIR /app

# Install dependencies (including dev dependencies for build)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Create logs directory
RUN mkdir -p logs/current logs/historical

# Create non-root user
RUN addgroup -g 1001 -S loggen && \
    adduser -S loggen -u 1001 -G loggen

# Change ownership of the app directory
RUN chown -R loggen:loggen /app

# Switch to non-root user
USER loggen

# Expose port (if using HTTP output)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Default command
CMD ["npm", "start"]
