# Use the official Node.js 20 image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy source files
COPY index.ts ./
COPY labels.json ./

# Build TypeScript
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm ci --only=production && npm cache clean --force

# Create a non-root user
RUN groupadd -r labeler && useradd -r -g labeler labeler
RUN chown -R labeler:labeler /app
USER labeler

# Expose ports (fly.io will set PORT and INTERNAL_API_PORT environment variables)
EXPOSE 8080 8081

# Start the application from the compiled JavaScript
CMD ["node", "dist/index.js"]