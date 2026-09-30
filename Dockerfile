# Use official Node.js image from Docker Hub (authentic source)
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402

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
RUN npm prune --omit=dev

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

# Probe the running service's /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get({host:'127.0.0.1',port:process.env.HTTP_PORT||3000,path:'/health',timeout:5000},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Default command
CMD ["node", "dist/index.js"]
